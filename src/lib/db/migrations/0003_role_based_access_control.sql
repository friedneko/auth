-- RBAC migrations

CREATE TABLE `roles` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `description` text,
  `permissions` text NOT NULL DEFAULT '{}',
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer))
);
CREATE UNIQUE INDEX `roles_name_unique` ON `roles` (`name`);

CREATE TABLE `user_roles` (
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  `role_id` text NOT NULL REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade,
  `created_at` integer NOT NULL DEFAULT (cast(strftime('%s', 'now') as integer)),
  PRIMARY KEY(`user_id`, `role_id`)
);

-- Insert default roles
INSERT OR IGNORE INTO roles (id, name, description, permissions) VALUES
  ('role:admin', 'Admin', 'Full access to the IDP', '{"*": true}'),
  ('role:user', 'User', 'Regular IDP user', '{"use_authorize": true, "use_token": true}');

-- Assign admin role to first user (if exists) or any user with id=1
INSERT OR IGNORE INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r WHERE r.name = 'admin' AND u.id = 1;
