/**
 * OIDC Discovery document (RFC 8414, OIDC Discovery 1.0).
 *
 * Served at `/.well-known/openid-configuration`.
 */

import type { DiscoveryDocument } from "./types";

export function buildDiscoveryDocument(issuer: string): DiscoveryDocument {
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    userinfo_endpoint: `${issuer}/userinfo`,
    jwks_uri: `${issuer}/jwks`,
    end_session_endpoint: `${issuer}/end_session`,
    revocation_endpoint: `${issuer}/token`, // reuse token endpoint for revocation
    introspection_endpoint: `${issuer}/token`, // reuse token endpoint for introspection
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["client_secret_post", "client_secret_basic", "none"],
    id_token_signing_alg_values_supported: ["ES256"],
    subject_types_supported: ["public"],
    code_challenge_methods_supported: ["S256", "plain"],
    claims_supported: ["sub", "email", "email_verified", "name", "preferred_username"],
    token_endpoint_auth_method: "client_secret_post",
    userinfo_signing_alg_values_supported: ["none"],
  };
}
