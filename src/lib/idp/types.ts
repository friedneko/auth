/**
 * Shared types used across the IDP implementation.
 */

import type { JWTPayload, JSONWebKeySet } from "jose";

/** A Drizzle database instance. */
export type Db = import("../db/client").Database;

/**
 * A registered OAuth client as stored in D1.
 */
export interface OAuthClient {
  id: string;
  secretHash: string | null;
  name: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A user session record in D1.
 */
export interface OAuthSessionRecord {
  id: string;
  userId: number;
  expiresAt: Date;
  revoked: number;
  createdAt: Date;
}

/**
 * JWT payload for the session cookie.
 * Contains only session id and user id. Role is fetched from DB on each request.
 */
export interface SessionTokenPayload extends JWTPayload {
  sid: string; // session id in D1
  uid: number; // user id
}

/**
 * A signing key stored in D1.
 */
export interface SigningKey {
  id: string; // kid
  jwkPrivate: string; // JSON string of private JWK
  jwkPublic: string; // JSON string of public JWK
  alg: string;
  createdAt: Date;
  isPrimary: number;
}

/**
 * Authorization code or refresh token grant record.
 */
export interface OAuthGrant {
  id: string; // hash of the code / token
  type: "authorization_code" | "refresh_token";
  clientId: string;
  userId: number;
  redirectUri: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  expiresAt: Date | null;
  consumed: number;
  createdAt: Date;
}

/**
 * Parsed authorization request parameters.
 */
export interface AuthorizationRequest {
  response_type: string;
  client_id: string;
  redirect_uri: string;
  scope: string;
  state: string | null;
  nonce: string | null;
  code_challenge: string | null;
  code_challenge_method: string | null;
}

/**
 * Token endpoint request (authorization_code grant).
 */
export interface TokenRequestCode {
  grant_type: "authorization_code";
  code: string;
  redirect_uri: string;
  client_id: string;
  code_verifier: string;
}

/**
 * Token endpoint request (refresh_token grant).
 */
export interface TokenRequestRefresh {
  grant_type: "refresh_token";
  refresh_token: string;
  client_id: string;
}

/** Token endpoint response. */
export interface TokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  id_token: string;
  refresh_token?: string;
  scope?: string;
}

/** UserInfo response. */
export interface UserInfoResponse {
  sub: string;
  name: string | null;
  email: string;
  email_verified?: boolean;
  [key: string]: unknown;
}

/** OIDC discovery document. */
export interface DiscoveryDocument {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  jwks_uri: string;
  end_session_endpoint: string;
  introspection_endpoint: string;
  revocation_endpoint: string;
  response_types_supported: string[];
  grant_types_supported: string[];
  token_endpoint_auth_methods_supported: string[];
  id_token_signing_alg_values_supported: string[];
  subject_types_supported: string[];
  code_challenge_methods_supported: string[];
  claims_supported: string[];
  [key: string]: unknown;
}

/** OAuth error response. */
export interface OAuthError {
  error: string;
  error_description?: string;
  error_uri?: string;
}

/** The public JWK Set returned by the JWKS endpoint. */
export type JWKSet = JSONWebKeySet;
