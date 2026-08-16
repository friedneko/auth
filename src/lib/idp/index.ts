/**
 * OIDC / OAuth 2.1 IDP — barrel export for shared utility modules.
 *
 * Route-specific handlers live directly in src/pages/_api/
 */

// Core utilities
export * from "./constants";
export { getIssuer, getDb } from "../env";

// Types
export type {
  OAuthClient,
  OAuthGrant,
  SessionTokenPayload,
  AuthorizationRequest,
  TokenRequestCode,
  TokenRequestRefresh,
  TokenResponse,
  UserInfoResponse,
  DiscoveryDocument,
  OAuthError,
  JWKSet,
  SigningKey,
} from "./types";

// Crypto
export {
  getSigningKey,
  ensureSigningKey,
  createSessionJwt,
  verifySessionJwt,
  createAccessToken,
  createIdToken,
  getJwks,
  createJwkSetResolver,
  generatePkcePair,
  verifyPkce,
  hashPassword,
  verifyPassword,
  hashSecret,
  verifySecret,
  sha256Hex,
  base64UrlEncode,
  bytesToHex,
  signJwt,
  verifyJwt,
} from "./crypto";

// Session management
export { createSession, getSession, destroySession } from "./session";
export type { AuthenticatedUser, SessionInfo } from "./session";

// Cookie helpers
export {
  parseCookies,
  getSessionToken,
  serializeSessionCookie,
  clearSessionCookie,
  setSessionCookie,
  clearSessionCookieOnResponse,
  setErrorCookie,
  getErrorCookie,
} from "./cookies";

// DB helpers
export {
  getClient,
  authenticateClient,
  isValidRedirect,
  saveAuthorizationCode,
  consumeAuthorizationCode,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  getUser,
  hasAuthorizedClient,
  recordAuthorization,
} from "./db";

// Discovery document builder
export { buildDiscoveryDocument } from "./discovery";

// RBAC utilities
export { userHasPermission, sessionHasPermission, assignRole, getUserRoles } from "./rbac";
export type { IdpPermission } from "./rbac";
