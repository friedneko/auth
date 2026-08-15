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

CREATE TABLE IF NOT EXISTS `oauth_refresh_tokens` (
  `id` text PRIMARY KEY NOT NULL,
  `client_id` text NOT NULL,
  `user_id` integer NOT NULL,
  `expires_at` integer,
  `consumed` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
  FOREIGN KEY (`client_id`) REFERENCES `oauth_clients`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

-- RBAC tables
CREATE TABLE IF NOT EXISTS `roles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `permissions` text NOT NULL DEFAULT '{}',
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);
CREATE UNIQUE INDEX IF NOT EXISTS `roles_name_unique` ON `roles` (`name`);

CREATE TABLE IF NOT EXISTS `user_roles` (
  `user_id` integer NOT NULL,
  `role_id` text NOT NULL,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`user_id`, `role_id`)
);

INSERT OR IGNORE INTO `roles` (id, name, description, permissions) VALUES
  ('role:admin', 'Admin', 'Full access to the IDP', '{"*": true}'),
  ('role:user', 'User', 'Regular IDP user', '{"use_authorize": true, "use_token": true}');
