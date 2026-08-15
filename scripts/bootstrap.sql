-- Bootstrap script for initial OIDC client registration
-- Run with: wrangler d1 execute auth_db --remote --file=scripts/bootstrap.sql

-- Insert default client (adjust as needed)
INSERT OR IGNORE INTO oauth_clients (
  id, secret_hash, name, redirect_uris, grant_types, response_types, token_endpoint_auth_method
) VALUES (
  'my-app',
  NULL,  -- public client (no secret)
  'My App',
  '["http://localhost:3000/callback","https://example.com/callback"]',
  '["authorization_code","refresh_token"]',
  '["code"]',
  'none'  -- public client
);
