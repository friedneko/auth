-- RBAC migrations (0003)
-- Adds role-based access control tables and permissions system.

-- Drop old roles table if it has the wrong schema (no weight column),
-- then recreate with the correct schema.
DROP TABLE IF EXISTS `roles`;

CREATE TABLE `roles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL UNIQUE,
  `description` text,
  `weight` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);

CREATE TABLE `permissions` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL UNIQUE,
  `description` text,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);

CREATE TABLE `role_permissions` (
  `role_id` text NOT NULL REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
  `permission_id` text NOT NULL REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`role_id`, `permission_id`)
);

CREATE TABLE `user_permissions` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `permission_id` text NOT NULL REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`user_id`, `permission_id`)
);

-- user_roles table (updated to include foreign keys matching schema.ts)
DROP TABLE IF EXISTS `user_roles`;
CREATE TABLE `user_roles` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `role_id` text NOT NULL REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`user_id`, `role_id`)
);

-- API Keys tables
CREATE TABLE `api_keys` (
  `id` text PRIMARY KEY NOT NULL,
  `key_hash` text NOT NULL,
  `name` text,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  `updated_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);

CREATE TABLE `api_key_permissions` (
  `api_key_id` text NOT NULL REFERENCES `api_keys`(`id`) ON UPDATE no action ON DELETE cascade,
  `permission_id` text NOT NULL REFERENCES `permissions`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`api_key_id`, `permission_id`)
);

-- Add scopes/nonce columns to oauth_grants for proper OIDC token issuance
ALTER TABLE `oauth_grants` ADD COLUMN `scopes` text;
ALTER TABLE `oauth_grants` ADD COLUMN `nonce` text;

-- Insert default roles (weight determines hierarchy; higher = more privileged)
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
