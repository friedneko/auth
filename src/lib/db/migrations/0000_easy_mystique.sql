CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text(255) NOT NULL,
	`name` text(100),
	`created_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(strftime('%s', 'now') as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);