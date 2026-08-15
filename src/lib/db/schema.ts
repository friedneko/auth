import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";

/**
 * Users table — extended with a password hash for local IDP authentication.
 */
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  email: text("email", { length: 255 }).notNull().unique(),
  name: text("name", { length: 100 }),
  passwordHash: text("password_hash", { length: 255 }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
});

/**
 * Registered OAuth/OIDC clients (e.g. web apps, mobile apps).
 */
export const oauthClients = sqliteTable("oauth_clients", {
  id: text("id").primaryKey(), // client_id
  secretHash: text("secret_hash"), // PBKDF2-hash of client_secret (null for public clients)
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").notNull(), // JSON stringified string[]
  grantTypes: text("grant_types").notNull(), // JSON stringified string[]
  responseTypes: text("response_types").notNull(), // JSON stringified string[]
  tokenEndpointAuthMethod: text("token_endpoint_auth_method")
    .notNull()
    .default("client_secret_post"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
});

/**
 * Sessions — stored in DB, referenced by a JWT cookie.
 * The JWT in the cookie contains the session id; the full session row
 * is loaded from the DB on each request for revocation support.
 */
export const oauthSessions = sqliteTable("oauth_sessions", {
  id: text("id").primaryKey(), // UUID, also stored in the session JWT
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  revoked: integer("revoked").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
});

/**
 * Grants — authorization codes and refresh tokens.
 * `id` stores the *hash* of the code/token so the raw value is never persisted.
 */
export const oauthGrants = sqliteTable("oauth_grants", {
  id: text("id").primaryKey(), // hash of the code or refresh token
  type: text("type").notNull(), // 'authorization_code' | 'refresh_token'
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri"), // for authorization_code only
  codeChallenge: text("code_challenge"), // PKCE
  codeChallengeMethod: text("code_challenge_method"), // 'S256' | 'plain'
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  consumed: integer("consumed").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
});

/**
 * Signing keys for JWT signing and JWKS endpoint.
 * Private JWK is stored as JSON text.
 */
export const oauthKeys = sqliteTable("oauth_keys", {
  id: text("id").primaryKey(), // kid
  jwkPrivate: text("jwk_private").notNull(), // JSON string
  jwkPublic: text("jwk_public").notNull(), // JSON string (public JWK)
  alg: text("alg").notNull(), // 'ES256' etc.
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(cast(strftime('%s', 'now') as integer))`),
  isPrimary: integer("is_primary").notNull().default(1),
});

/**
 * Auto-approved client/authorizations (for skipping consent screen).
 */
export const oauthAuthorizations = sqliteTable(
  "oauth_authorizations",
  {
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(cast(strftime('%s', 'now') as integer))`),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.clientId, table.userId] }),
  }),
);

export const schema = {
  users,
  oauthClients,
  oauthSessions,
  oauthGrants,
  oauthKeys,
  oauthAuthorizations,
};
