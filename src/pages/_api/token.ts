/**
 * Token endpoint — `POST /token`
 *
 * Handles grant_type=authorization_code (with PKCE) and grant_type=refresh_token.
 * Returns signed JWT access_token + id_token (+ refresh_token).
 */

import {
  sha256Hex,
  base64UrlEncode,
  getSigningKey,
  createAccessToken,
  createIdToken,
  verifySecret,
} from "@/lib/idp/crypto";
import {
  consumeAuthorizationCode,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  getClient,
  getUser,
} from "@/lib/idp/db";
import { GRANT_TYPE, OAUTH_ERROR, REFRESH_TOKEN_TTL, ACCESS_TOKEN_TTL } from "@/lib/idp/constants";
import { getIssuer } from "@/lib/env";

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------

async function getRequestBody(req: Request): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await req.json()) as Record<string, string>;
  }
  const formData = await req.formData();
  const result: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    result[key] = typeof value === "string" ? value : "";
  }
  return result;
}

function extractBasicAuth(req: Request): { clientId: string; clientSecret: string | null } | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) return null;
  try {
    const decoded = atob(authHeader.slice(6));
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    const clientId = decoded.slice(0, idx);
    const clientSecret = decoded.slice(idx + 1);
    return { clientId, clientSecret: clientSecret || null };
  } catch {
    return null;
  }
}

function jsonResponse(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      pragma: "no-cache",
    },
  });
}

function tokenError(error: string, description: string, status: number): Response {
  return jsonResponse({ error, error_description: description }, status);
}

// ---------------------------------------------------------------------------
// POST /token
// ---------------------------------------------------------------------------

export const POST = async (req: Request): Promise<Response> => {
  const body = await getRequestBody(req);
  const grantType = body.grant_type;

  // Extract client credentials
  let clientId: string | null = null;
  let clientSecret: string | null = null;

  const basicAuth = extractBasicAuth(req);
  if (basicAuth) {
    clientId = basicAuth.clientId;
    clientSecret = basicAuth.clientSecret;
  }
  if (!clientId) {
    clientId = body.client_id ?? null;
    clientSecret = body.client_secret ?? null;
  }

  if (!clientId) {
    return tokenError(OAUTH_ERROR.invalid_client, "client_id is required", 401);
  }

  const client = await getClient(clientId);
  if (!client) {
    return tokenError(OAUTH_ERROR.invalid_client, "Unknown client", 401);
  }

  const isPublic = client.tokenEndpointAuthMethod === "none";
  if (!isPublic) {
    if (!client.secretHash) {
      return tokenError(OAUTH_ERROR.invalid_client, "Client has no secret", 401);
    }
    if (!clientSecret || !(await verifySecret(clientSecret, client.secretHash))) {
      return tokenError(OAUTH_ERROR.invalid_client, "Invalid client secret", 401);
    }
  }

  if (grantType === GRANT_TYPE.authorization_code) {
    return handleAuthCode(body, client, req);
  }
  if (grantType === GRANT_TYPE.refresh_token) {
    return handleRefreshToken(body, client, req);
  }

  return tokenError(
    OAUTH_ERROR.unsupported_grant_type,
    `Unsupported grant_type: ${grantType}`,
    400,
  );
};

// ---------------------------------------------------------------------------
// Authorization code grant
// ---------------------------------------------------------------------------

async function handleAuthCode(
  body: Record<string, string>,
  client: { id: string; redirectUris: string[] },
  req: Request,
): Promise<Response> {
  const code = body.code;
  const redirectUri = body.redirect_uri;
  const codeVerifier = body.code_verifier;

  if (!code) return tokenError(OAUTH_ERROR.invalid_grant, "missing code", 400);
  if (!redirectUri) return tokenError(OAUTH_ERROR.invalid_grant, "missing redirect_uri", 400);
  if (!codeVerifier)
    return tokenError(OAUTH_ERROR.invalid_request, "missing code_verifier (PKCE required)", 400);
  if (!client.redirectUris.includes(redirectUri)) {
    return tokenError(OAUTH_ERROR.invalid_grant, "redirect_uri mismatch", 400);
  }

  const codeHash = await sha256Hex(code);
  const result = await consumeAuthorizationCode(codeHash);
  if (!result)
    return tokenError(OAUTH_ERROR.invalid_grant, "invalid or expired authorization code", 400);

  const { grant, userId } = result;

  // SECURITY: Validate redirect_uri matches the one stored in the authorization code.
  // This prevents a code issued for one redirect URI from being exchanged at a
  // different (but client-registered) redirect URI.
  if (grant.redirectUri !== redirectUri) {
    return tokenError(OAUTH_ERROR.invalid_grant, "redirect_uri mismatch (stored code)", 400);
  }

  // Verify PKCE
  if (grant.codeChallenge) {
    const challengeMethod = grant.codeChallengeMethod || "plain";
    const challenge =
      challengeMethod === "S256"
        ? base64UrlEncode(
            new Uint8Array(
              await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)),
            ),
          )
        : codeVerifier;
    if (challenge !== grant.codeChallenge) {
      return tokenError(OAUTH_ERROR.invalid_grant, "PKCE verification failed", 400);
    }
  }

  // Use scopes from the authorization code (fall back to defaults if not stored)
  const scopes = grant.scopes ?? ["openid", "profile", "email"];
  const signingKey = await getSigningKey();
  const issuer = getIssuer(req);
  const user = await getUser(userId);
  if (!user) return tokenError(OAUTH_ERROR.invalid_request, "user not found", 400);

  const accessToken = await createAccessToken(userId, client.id, scopes, issuer, signingKey);
  const idToken = await createIdToken(
    userId,
    user.email,
    issuer,
    client.id,
    grant.nonce,
    signingKey,
  );

  // Refresh token
  const refreshTokenRaw = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const refreshTokenHash = await sha256Hex(refreshTokenRaw);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  await saveRefreshToken(refreshTokenHash, client.id, userId, refreshExpiresAt, scopes);

  return jsonResponse(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      id_token: idToken,
      refresh_token: refreshTokenRaw,
      scope: scopes.join(" "),
    },
    200,
  );
}

// ---------------------------------------------------------------------------
// Refresh token grant
// ---------------------------------------------------------------------------

async function handleRefreshToken(
  body: Record<string, string>,
  client: { id: string },
  req: Request,
): Promise<Response> {
  const refreshToken = body.refresh_token;
  if (!refreshToken) return tokenError(OAUTH_ERROR.invalid_grant, "missing refresh_token", 400);

  const refreshTokenHash = await sha256Hex(refreshToken);
  const result = await getRefreshToken(refreshTokenHash, client.id);
  if (!result)
    return tokenError(OAUTH_ERROR.invalid_grant, "invalid or expired refresh token", 400);

  const { userId, scopes } = result;
  await revokeRefreshToken(refreshTokenHash); // rotate

  const signingKey = await getSigningKey();
  const issuer = getIssuer(req);
  const user = await getUser(userId);
  if (!user) return tokenError(OAUTH_ERROR.invalid_request, "user not found", 400);

  // Use scopes from the stored refresh token (fall back to defaults if not stored)
  const tokenScopes = scopes ?? ["openid", "profile", "email"];
  const accessToken = await createAccessToken(userId, client.id, tokenScopes, issuer, signingKey);
  const idToken = await createIdToken(userId, user.email, issuer, client.id, null, signingKey);

  const newRefreshTokenRaw = base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
  const newRefreshTokenHash = await sha256Hex(newRefreshTokenRaw);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  await saveRefreshToken(newRefreshTokenHash, client.id, userId, refreshExpiresAt, tokenScopes);

  return jsonResponse(
    {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: ACCESS_TOKEN_TTL,
      id_token: idToken,
      refresh_token: newRefreshTokenRaw,
      scope: tokenScopes.join(" "),
    },
    200,
  );
}

export const getConfig = async () => ({ render: "dynamic" }) as const;
