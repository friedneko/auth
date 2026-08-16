-- ============================================================================
-- Schema: matches Drizzle ORM schema in src/lib/db/schema.ts
-- Applied via: wrangler d1 execute auth_db --file=migrations.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS `users` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `email` text(255) NOT NULL,
  `name` text(100),
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  `password_hash` text(255)
);
CREATE UNIQUE INDEX IF NOT EXISTS `users_email_unique` ON `users` (`email`);

CREATE TABLE IF NOT EXISTS `oauth_clients` (
  `id` text PRIMARY KEY NOT NULL,
  `secret_hash` text,
  `name` text NOT NULL,
  `redirect_uris` text NOT NULL,
  `grant_types` text NOT NULL,
  `response_types` text NOT NULL,
  `token_endpoint_auth_method` text DEFAULT 'client_secret_post' NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  `updated_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL
);

CREATE TABLE IF NOT EXISTS `oauth_grants` (
  `id` text PRIMARY KEY NOT NULL,
  `type` text NOT NULL,
  `client_id` text NOT NULL,
  `user_id` integer NOT NULL,
  `redirect_uri` text,
  `code_challenge` text,
  `code_challenge_method` text,
  `scopes` text,
  `nonce` text,
  `expires_at` integer,
  `consumed` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `oauth_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `jwk_private` text NOT NULL,
  `jwk_public` text NOT NULL,
  `alg` text NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  `is_primary` integer DEFAULT 1 NOT NULL
);

CREATE TABLE IF NOT EXISTS `oauth_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` integer NOT NULL,
  `expires_at` integer NOT NULL,
  `revoked` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `oauth_authorizations` (
  `client_id` text NOT NULL,
  `user_id` integer NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  PRIMARY KEY(`client_id`, `user_id`),
  FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- ============================================================================
-- RBAC tables
-- ============================================================================

CREATE TABLE IF NOT EXISTS `roles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL UNIQUE,
  `description` text,
  `weight` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);
CREATE UNIQUE INDEX IF NOT EXISTS `roles_name_unique` ON `roles` (`name`);

CREATE TABLE IF NOT EXISTS `permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL UNIQUE,
  `description` text,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);
CREATE UNIQUE INDEX IF NOT EXISTS `permissions_name_unique` ON `permissions` (`name`);

CREATE TABLE IF NOT EXISTS `role_permissions` (
  `role_id` text NOT NULL REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
  `permission_id` text NOT NULL REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`role_id`, `permission_id`)
);

CREATE TABLE IF NOT EXISTS `user_permissions` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `permission_id` text NOT NULL REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`user_id`, `permission_id`)
);

CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` integer NOT NULL,
  `role_id` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`user_id`, `role_id`)
);

-- ============================================================================
-- API Keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS `api_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `key_hash` text NOT NULL,
  `name` text,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);

CREATE TABLE IF NOT EXISTS `api_key_permissions` (
  `api_key_id` text NOT NULL REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
  `permission_id` text NOT NULL REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`api_key_id`, `permission_id`)
);

-- ============================================================================
-- Seed data
-- ============================================================================

-- Default roles (weight determines hierarchy; higher = more privileged)
INSERT OR IGNORE INTO `roles` (id, name, description, weight, created_at) VALUES
  ('role:admin', 'Admin', 'Full access to the IDP', 100, (cast(strftime('%s', 'now') as integer))),
  ('role:user', 'User', 'Regular IDP user', 10, (cast(strftime('%s', 'now') as integer)));

-- System permissions
INSERT OR IGNORE INTO `permissions` (id, name, description, created_at) VALUES
  ('use_authorize', 'Authorize', 'Can use the authorize endpoint', (cast(strftime('%s', 'now') as integer))),
  ('use_token', 'Token', 'Can use the token endpoint', (cast(strftime('%s', 'now') as integer))),
  ('use_userinfo', 'UserInfo', 'Can use the userinfo endpoint', (cast(strftime('%s', 'now') as integer))),
  ('manage_clients', 'Manage Clients', 'Can create and manage OAuth clients', (cast(strftime('%s', 'now') as integer))),
  ('manage_users', 'Manage Users', 'Can create and manage users', (cast(strftime('%s', 'now') as integer))),
  ('view_stats', 'View Stats', 'Can view admin statistics', (cast(strftime('%s', 'now') as integer))),
  ('configure', 'Configure', 'Can configure roles, permissions, and API keys', (cast(strftime('%s', 'now') as integer)));

-- Admin role gets all permissions
INSERT OR IGNORE INTO `role_permissions` (role_id, permission_id, created_at)
SELECT 'role:admin', p.id, (cast(strftime('%s', 'now') as integer))
FROM permissions p;

-- Regular user gets basic permissions
INSERT OR IGNORE INTO `role_permissions` (role_id, permission_id, created_at) VALUES
  ('role:user', 'use_authorize', (cast(strftime('%s', 'now') as integer))),
  ('role:user', 'use_token', (cast(strftime('%s', 'now') as integer)));

-- Assign admin role to the first user (if exists)
INSERT OR IGNORE INTO `user_roles` (user_id, role_id, created_at)
SELECT u.id, r.id, (cast(strftime('%s', 'now') as integer))
FROM users u
CROSS JOIN roles r
WHERE r.name = 'admin' AND u.id = 1;
