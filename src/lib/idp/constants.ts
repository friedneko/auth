/**
 * Cookie names used by the IDP.
 */
export const SESSION_COOKIE_NAME = "idp_session";
export const ERROR_COOKIE_NAME = "idp_error";

/**
 * OAuth / OIDC error codes (RFC 6749 §5.2, RFC 6749 §4.1.2.1, OIDC Core §3.1.2.6).
 */
export const OAUTH_ERROR = {
  invalid_request: "invalid_request",
  unauthorized_client: "unauthorized_client",
  access_denied: "access_denied",
  unsupported_response_type: "unsupported_response_type",
  invalid_scope: "invalid_scope",
  invalid_grant: "invalid_grant",
  invalid_client: "invalid_client",
  invalid_token: "invalid_token",
  temporarily_unavailable: "temporarily_unavailable",
  unsupported_grant_type: "unsupported_grant_type",
} as const;

/**
 * PKCE challenge methods.
 */
export const CODE_CHALLENGE_METHOD = {
  s256: "S256",
  plain: "plain",
} as const;

/**
 * Supported OAuth 2.0 / OIDC grant types.
 */
export const GRANT_TYPE = {
  authorization_code: "authorization_code",
  refresh_token: "refresh_token",
} as const;

/**
 * Supported response types.
 */
export const RESPONSE_TYPE = {
  code: "code",
} as const;

/**
 * Token endpoint authentication methods.
 */
export const TOKEN_AUTH_METHOD = {
  client_secret_post: "client_secret_post",
  client_secret_basic: "client_secret_basic",
  none: "none",
} as const;

/**
 * JWT / signing algorithm used throughout.
 */
export const SIGNING_ALGORITHM = "ES256";

/**
 * Session JWT lifetime (seconds).
 */
export const SESSION_JWT_TTL = 60 * 60 * 24 * 30; // 30 days

/**
 * Session record TTL (seconds) — same as JWT so they expire together.
 */
export const SESSION_TTL = SESSION_JWT_TTL;

/**
 * Authorization code TTL (seconds) — typically 5-15 minutes.
 */
export const AUTH_CODE_TTL = 60 * 10; // 10 minutes

/**
 * Access token TTL (seconds).
 */
export const ACCESS_TOKEN_TTL = 60 * 60; // 1 hour

/**
 * ID token max age (seconds).
 */
export const ID_TOKEN_MAX_AGE = 60 * 60; // 1 hour

/**
 * Refresh token TTL (seconds) — null means no expiry (persistent).
 * We use 90 days as a reasonable default.
 */
export const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 90; // 90 days

/**
 * PBKDF2 iterations for password hashing.
 */
export const PBKDF2_ITERATIONS = 100_000;

/**
 * PBKDF2 iterations for client secret hashing.
 */
export const CLIENT_SECRET_ITERATIONS = 100_000;
