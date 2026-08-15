/**
 * Cryptographic utilities for the IDP:
 * - Signing key lifecycle (generate, store in D1, load, JWKS)
 * - Session JWT creation / verification
 * - Access token / ID token signing
 * - Password hashing (PBKDF2-SHA256)
 * - Client secret hashing
 * - PKCE helpers
 * - Simple SHA-256 hashing (for auth codes / refresh tokens)
 */

import {
  SignJWT,
  jwtVerify,
  generateKeyPair,
  exportJWK,
  importJWK,
  calculateJwkThumbprint,
  createLocalJWKSet,
  type JWTPayload,
  type JWK,
  type CryptoKey,
} from "jose";
import { SIGNING_ALGORITHM, PBKDF2_ITERATIONS, SESSION_JWT_TTL } from "./constants";
import type { SessionTokenPayload, SigningKey } from "./types";
import { getDb } from "../env";
import { getKv } from "../env";
import { oauthKeys } from "@/lib/db/schema";
import { asc } from "drizzle-orm";

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Hex / base64url encoding helpers
// ---------------------------------------------------------------------------

export function base64UrlEncode(bytes: Uint8Array | ArrayBuffer): string {
  let str = "";
  const buf = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  for (let i = 0; i < buf.length; i++) {
    str += String.fromCharCode(buf[i]!);
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

// ---------------------------------------------------------------------------
// Password hashing (PBKDF2-SHA256)
// ---------------------------------------------------------------------------

/** Hash a password with PBKDF2-SHA256. Returns `iterations$saltHex$hashHex`. */
export async function hashPassword(
  password: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return `${iterations}$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(bits))}`;
}

/** Verify a password against a stored PBKDF2 hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [iterStr, saltHex, hashHex] = stored.split("$");
  if (!iterStr || !saltHex || !hashHex) return false;
  const iterations = parseInt(iterStr, 10);
  const salt = hexToBytes(saltHex);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToHex(new Uint8Array(bits)) === hashHex;
}

// ---------------------------------------------------------------------------
// Secret hashing (PBKDF2, for client secrets)
// ---------------------------------------------------------------------------

export async function hashSecret(
  secret: string,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  return hashPassword(secret, iterations);
}

export async function verifySecret(secret: string, stored: string): Promise<boolean> {
  return verifyPassword(secret, stored);
}

// ---------------------------------------------------------------------------
// Simple SHA-256 (for auth codes / refresh tokens — high-entropy input)
// ---------------------------------------------------------------------------

/**
 * SHA-256 hash a string and return the hex digest.
 * Used for hashing authorization codes and refresh tokens before storage.
 */
export async function sha256Hex(input: string): Promise<string> {
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(hash));
}

/** SHA-256 returning raw bytes. */
async function sha256Bytes(input: string): Promise<Uint8Array> {
  const data = encoder.encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return new Uint8Array(hash);
}

// ---------------------------------------------------------------------------
// Signing key management
// ---------------------------------------------------------------------------

/**
 * Ensure at least one signing key exists and is cached in KV. If none exist in
 * D1, generate a new ES256 key pair and persist it. The primary key's data is
 * also cached in KV for fast lookups on subsequent requests.
 */
export async function ensureSigningKey(): Promise<SigningKey> {
  // Try KV cache first
  const kv = getKv();
  if (kv) {
    const cached = await kv.get("__signing_key__:primary");
    if (cached) {
      try {
        return JSON.parse(cached) as SigningKey;
      } catch {
        // Corrupted cache — fall through to D1
      }
    }
  }

  // Fallback to D1
  const db = await getDb();
  const existing = await db.select().from(oauthKeys).orderBy(asc(oauthKeys.isPrimary)).limit(1);

  if (existing.length > 0) {
    const key = rowToKey(existing[0]!);
    // Cache in KV for fast subsequent access
    if (kv) {
      try {
        void kv.put("__signing_key__:primary", JSON.stringify(key));
      } catch {
        // KV write failure is non-fatal
      }
    }
    return key;
  }

  // Generate new key pair
  const { privateKey, publicKey } = await generateKeyPair(SIGNING_ALGORITHM, {
    extractable: true,
  });
  const privateJwk = await exportJWK(privateKey);
  const publicJwk = await exportJWK(publicKey);
  const kid = await calculateJwkThumbprint(publicJwk);

  const now = new Date();
  const jwkPrivateStr = JSON.stringify(privateJwk);
  const jwkPublicStr = JSON.stringify(publicJwk);

  const key: SigningKey = {
    id: kid,
    jwkPrivate: jwkPrivateStr,
    jwkPublic: jwkPublicStr,
    alg: SIGNING_ALGORITHM,
    createdAt: now,
    isPrimary: 1,
  };

  await db.insert(oauthKeys).values({
    id: kid,
    jwkPrivate: jwkPrivateStr,
    jwkPublic: jwkPublicStr,
    alg: SIGNING_ALGORITHM,
    createdAt: now,
    isPrimary: 1,
  });

  // Cache in KV
  if (kv) {
    try {
      void kv.put("__signing_key__:primary", JSON.stringify(key));
    } catch {
      // Non-fatal
    }
  }

  return key;
}

/**
 * Load the primary signing key and its CryptoKey. Generates one on first call.
 */
export async function getSigningKey(): Promise<{
  kid: string;
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  alg: string;
}> {
  const key = await ensureSigningKey();
  const privateJwk = JSON.parse(key.jwkPrivate) as JWK;
  const publicJwk = JSON.parse(key.jwkPublic) as JWK;
  const privateKey = (await importJWK(privateJwk, key.alg)) as CryptoKey;
  const publicKey = (await importJWK(publicJwk, key.alg)) as CryptoKey;
  return { kid: key.id, privateKey, publicKey, alg: key.alg };
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/** Sign a JWT with the given key. */
export async function signJwt(
  payload: JWTPayload,
  key: CryptoKey,
  kid: string,
  alg: string,
  expiresIn: string | number,
): Promise<string> {
  const builder = new SignJWT(payload).setProtectedHeader({ alg, kid, typ: "JWT" }).setIssuedAt();

  if (typeof expiresIn === "string") {
    builder.setExpirationTime(expiresIn);
  } else {
    builder.setExpirationTime(Math.floor(Date.now() / 1000) + expiresIn);
  }

  return builder.sign(key);
}

/** Verify a JWT and return its payload. */
export async function verifyJwt(
  token: string,
  key: CryptoKey,
  opts?: { issuer?: string; audience?: string | string[] },
): Promise<JWTPayload> {
  const result = await jwtVerify(token, key, {
    algorithms: [SIGNING_ALGORITHM],
    ...(opts?.issuer && { issuer: opts.issuer }),
    ...(opts?.audience && { audience: opts.audience }),
  });
  return result.payload;
}

// ---------------------------------------------------------------------------
// Session JWT
// ---------------------------------------------------------------------------

/** Create a session JWT containing the session id, user id, and optional role. */
export async function createSessionJwt(
  sessionId: string,
  userId: number,
  issuer: string,
  signingKey: { privateKey: CryptoKey; kid: string; alg: string },
  role?: string,
): Promise<string> {
  const payload: SessionTokenPayload = {
    sid: sessionId,
    uid: userId,
    ...(role ? { role } : {}),
  };
  return signJwt(payload, signingKey.privateKey, signingKey.kid, signingKey.alg, SESSION_JWT_TTL);
}

/** Verify a session JWT. Returns the payload or null on failure. */
export async function verifySessionJwt(
  token: string,
  signingKey: { publicKey: CryptoKey; kid: string; alg: string },
): Promise<SessionTokenPayload | null> {
  try {
    const payload = await verifyJwt(token, signingKey.publicKey);
    if (!payload.sid || !payload.uid) return null;
    return payload as unknown as SessionTokenPayload;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Access token + ID token
// ---------------------------------------------------------------------------

/** Build a signed access token (JWT). */
export async function createAccessToken(
  userId: number,
  clientId: string,
  scopes: string[],
  issuer: string,
  signingKey: { privateKey: CryptoKey; kid: string; alg: string },
): Promise<string> {
  return signJwt(
    { sub: String(userId), aud: clientId, scope: scopes.join(" "), iss: issuer },
    signingKey.privateKey,
    signingKey.kid,
    signingKey.alg,
    3600,
  );
}

/** Build a signed ID token (JWT) per OIDC Core §2.2. */
export async function createIdToken(
  userId: number,
  userEmail: string,
  issuer: string,
  clientId: string,
  nonce: string | null,
  signingKey: { privateKey: CryptoKey; kid: string; alg: string },
): Promise<string> {
  const jwt = new SignJWT({
    email: userEmail,
    email_verified: true,
    ...(nonce ? { nonce } : {}),
  })
    .setProtectedHeader({ alg: signingKey.alg, kid: signingKey.kid, typ: "JWT" })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(clientId)
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .setSubject(String(userId));

  return jwt.sign(signingKey.privateKey);
}

// ---------------------------------------------------------------------------
// JWKS
// ---------------------------------------------------------------------------

/** Build the public JWK Set from all signing keys in D1 (with KV cache). */
export async function getJwks(): Promise<{ keys: JWK[] }> {
  // Try KV cache first
  const kv = getKv();
  if (kv) {
    const cached = await kv.get("__jwks__");
    if (cached) {
      try {
        return JSON.parse(cached) as { keys: JWK[] };
      } catch {
        // Corrupted cache — fall through to D1
      }
    }
  }

  const db = await getDb();
  const rows = await db.select().from(oauthKeys);
  const keys: JWK[] = [];
  for (const row of rows) {
    const pub = JSON.parse(row.jwkPublic) as JWK;
    // Build a clean JWK object to satisfy exactOptionalPropertyTypes
    const cleanJwk: JWK = {
      kty: pub.kty!,
      alg: row.alg,
      use: "sig",
      kid: row.id,
    };
    if (pub.crv !== undefined) cleanJwk.crv = pub.crv;
    if (pub.x !== undefined) cleanJwk.x = pub.x;
    if (pub.y !== undefined) cleanJwk.y = pub.y;
    if (pub.n !== undefined) cleanJwk.n = pub.n;
    if (pub.e !== undefined) cleanJwk.e = pub.e;
    keys.push(cleanJwk);
  }

  const result = { keys };

  // Cache in KV
  if (kv) {
    try {
      void kv.put("__jwks__", JSON.stringify(result));
    } catch {
      // Non-fatal
    }
  }

  return result;
}

/** Create a local JWK set resolver (for verifying inbound JWTs). */
export function createJwkSetResolver(jwks: { keys: JWK[] }) {
  return createLocalJWKSet(jwks);
}

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/** Generate a random code verifier and its S256 challenge. */
export async function generatePkcePair(): Promise<{
  verifier: string;
  challenge: string;
  method: string;
}> {
  const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(verifierBytes);
  const challenge = base64UrlEncode(await sha256Bytes(verifier));
  return { verifier, challenge, method: "S256" };
}

/** Verify a PKCE code verifier against a stored challenge. */
export async function verifyPkce(
  verifier: string,
  challenge: string,
  method: string,
): Promise<boolean> {
  if (method === "S256") {
    const computed = base64UrlEncode(await sha256Bytes(verifier));
    return computed === challenge;
  }
  if (method === "plain") {
    return verifier === challenge;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

type KeyRow = typeof oauthKeys.$inferSelect;

function rowToKey(row: KeyRow): SigningKey {
  return {
    id: row.id,
    jwkPrivate: row.jwkPrivate,
    jwkPublic: row.jwkPublic,
    alg: row.alg,
    createdAt: typeof row.createdAt === "number" ? new Date(row.createdAt * 1000) : row.createdAt,
    isPrimary: row.isPrimary ?? 0,
  };
}
