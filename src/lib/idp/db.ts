/**
 * Database helpers for OAuth client / grant / authorization lookups.
 * All functions use Drizzle ORM against the Cloudflare D1 instance.
 */

import { and, eq, gt, sql } from "drizzle-orm";
import { oauthClients, oauthGrants, oauthAuthorizations, users } from "@/lib/db/schema";
import type { OAuthClient, OAuthGrant } from "./types";
import { getDb } from "../env";
import { verifySecret } from "./crypto";

// ---------------------------------------------------------------------------
// Client validation
// ---------------------------------------------------------------------------

/**
 * Load an OAuth client by id from D1.
 * The stored JSON columns are deserialized into arrays.
 */
export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: oauthClients.id,
      secretHash: oauthClients.secretHash,
      name: oauthClients.name,
      redirectUris: oauthClients.redirectUris,
      grantTypes: oauthClients.grantTypes,
      responseTypes: oauthClients.responseTypes,
      tokenEndpointAuthMethod: oauthClients.tokenEndpointAuthMethod,
      createdAt: oauthClients.createdAt,
      updatedAt: oauthClients.updatedAt,
    })
    .from(oauthClients)
    .where(eq(oauthClients.id, clientId));

  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    id: r.id,
    secretHash: r.secretHash,
    name: r.name,
    redirectUris: JSON.parse(r.redirectUris),
    grantTypes: JSON.parse(r.grantTypes),
    responseTypes: JSON.parse(r.responseTypes),
    tokenEndpointAuthMethod: r.tokenEndpointAuthMethod,
    createdAt: typeof r.createdAt === "number" ? new Date(r.createdAt * 1000) : r.createdAt,
    updatedAt: typeof r.updatedAt === "number" ? new Date(r.updatedAt * 1000) : r.updatedAt,
  };
}

/** Verify a redirect_uri is registered for a client. */
export async function isValidRedirect(clientId: string, redirectUri: string): Promise<boolean> {
  const client = await getClient(clientId);
  if (!client) return false;
  return client.redirectUris.includes(redirectUri);
}

/**
 * Authenticate a confidential client. Returns true if the client_id exists and
 * the secret matches (or the client is public and auth method is `none`).
 */
export async function authenticateClient(
  clientId: string,
  clientSecret: string | null,
  authMethod: string,
): Promise<boolean> {
  const client = await getClient(clientId);
  if (!client) return false;

  if (client.tokenEndpointAuthMethod === "none" || authMethod === "none") {
    return true;
  }

  if (!client.secretHash) return false;
  if (!clientSecret) return false;

  return verifySecret(clientSecret, client.secretHash);
}

// ---------------------------------------------------------------------------
// Authorization code grants
// ---------------------------------------------------------------------------

/**
 * Store an authorization code grant. Returns the raw code (which is sent to
 * the client); only the hash is persisted.
 */
export async function saveAuthorizationCode(params: {
  code: string;
  codeHash: string;
  clientId: string;
  userId: number;
  redirectUri: string;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  scopes: string[];
  nonce: string | null;
  expiresAt: Date;
}): Promise<void> {
  const db = await getDb();
  await db.insert(oauthGrants).values({
    id: params.codeHash,
    type: "authorization_code",
    clientId: params.clientId,
    userId: params.userId,
    redirectUri: params.redirectUri,
    codeChallenge: params.codeChallenge,
    codeChallengeMethod: params.codeChallengeMethod,
    scopes: JSON.stringify(params.scopes),
    nonce: params.nonce,
    expiresAt: params.expiresAt,
    consumed: 0,
  });
}

/**
 * Load and validate an authorization code. Checks expiry and consumption.
 * Returns the grant row + user id if valid.
 */
export async function consumeAuthorizationCode(
  codeHash: string,
): Promise<{ grant: OAuthGrant; userId: number } | null> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({
      id: oauthGrants.id,
      type: oauthGrants.type,
      clientId: oauthGrants.clientId,
      userId: oauthGrants.userId,
      redirectUri: oauthGrants.redirectUri,
      codeChallenge: oauthGrants.codeChallenge,
      codeChallengeMethod: oauthGrants.codeChallengeMethod,
      scopes: oauthGrants.scopes,
      nonce: oauthGrants.nonce,
      expiresAt: oauthGrants.expiresAt,
      consumed: oauthGrants.consumed,
      createdAt: oauthGrants.createdAt,
    })
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.id, codeHash),
        eq(oauthGrants.type, "authorization_code"),
        eq(oauthGrants.consumed, 0),
        gt(oauthGrants.expiresAt, now),
      ),
    );

  if (rows.length === 0) return null;
  const r = rows[0]!;

  await db.update(oauthGrants).set({ consumed: 1 }).where(eq(oauthGrants.id, codeHash));

  const grant: OAuthGrant = {
    id: r.id,
    type: r.type as "authorization_code" | "refresh_token",
    clientId: r.clientId,
    userId: r.userId,
    redirectUri: r.redirectUri,
    codeChallenge: r.codeChallenge,
    codeChallengeMethod: r.codeChallengeMethod,
    scopes: r.scopes ? JSON.parse(r.scopes) : null,
    nonce: r.nonce ?? null,
    expiresAt:
      r.expiresAt && typeof r.expiresAt === "number"
        ? new Date(r.expiresAt * 1000)
        : (r.expiresAt ?? null),
    consumed: r.consumed,
    createdAt: typeof r.createdAt === "number" ? new Date(r.createdAt * 1000) : r.createdAt,
  };

  return { grant, userId: r.userId };
}

// ---------------------------------------------------------------------------
// Refresh tokens
// ---------------------------------------------------------------------------

/**
 * Store a refresh token. The `tokenHash` is the SHA-256 hash of the raw
 * token value, which is never persisted.
 */
export async function saveRefreshToken(
  tokenHash: string,
  clientId: string,
  userId: number,
  expiresAt: Date,
  scopes: string[] = ["openid", "profile", "email"],
): Promise<void> {
  const db = await getDb();
  await db.insert(oauthGrants).values({
    id: tokenHash,
    type: "refresh_token",
    clientId,
    userId,
    redirectUri: null,
    codeChallenge: null,
    codeChallengeMethod: null,
    scopes: JSON.stringify(scopes),
    nonce: null,
    expiresAt,
    consumed: 0,
  });
}

/**
 * Look up a refresh token by its hash. Returns null if not found, expired,
 * or already revoked/consumed.
 */
export async function getRefreshToken(
  tokenHash: string,
  clientId: string,
): Promise<{ userId: number; scopes: string[] | null } | null> {
  const db = await getDb();
  const now = new Date();
  const rows = await db
    .select({ userId: oauthGrants.userId, scopes: oauthGrants.scopes })
    .from(oauthGrants)
    .where(
      and(
        eq(oauthGrants.id, tokenHash),
        eq(oauthGrants.type, "refresh_token"),
        eq(oauthGrants.clientId, clientId),
        eq(oauthGrants.consumed, 0),
        gt(oauthGrants.expiresAt, now),
      ),
    );

  if (rows.length === 0) return null;
  const r = rows[0]!;
  return {
    userId: r.userId,
    scopes: r.scopes ? JSON.parse(r.scopes) : null,
  };
}

/** Mark a refresh token as consumed (revoked). */
export async function revokeRefreshToken(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db.update(oauthGrants).set({ consumed: 1 }).where(eq(oauthGrants.id, tokenHash));
}

// ---------------------------------------------------------------------------
// User lookup
// ---------------------------------------------------------------------------

/**
 * Load a user by id for token / userinfo responses.
 */
export async function getUser(userId: number): Promise<{
  id: number;
  email: string;
  name: string | null;
} | null> {
  const db = await getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
    })
    .from(users)
    .where(eq(users.id, userId));

  if (rows.length === 0) return null;
  return rows[0]!;
}

// ---------------------------------------------------------------------------
// Authorization (consent) tracking
// ---------------------------------------------------------------------------

/**
 * Check if a user has already authorized a client (auto-approve).
 *
 * NOTE: `count(*)` always returns exactly one row (with 0 if no matches), so we
 * must check the count value, not the array length. The previous implementation
 * used `result.length > 0` which was *always true* — meaning the consent
 * screen was silently skipped for every user.
 */
export async function hasAuthorizedClient(userId: number, clientId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(oauthAuthorizations)
    .where(and(eq(oauthAuthorizations.userId, userId), eq(oauthAuthorizations.clientId, clientId)));

  return (result[0]?.count ?? 0) > 0;
}

/**
 * Record that a user has authorized a client.
 */
export async function recordAuthorization(userId: number, clientId: string): Promise<void> {
  const db = await getDb();
  await db.insert(oauthAuthorizations).values({ clientId, userId }).onConflictDoNothing();
}
