import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * Example SQLite (D1) schema for the `auth` app scaffold.
 *
 * This is a starting point — replace/augment `users` with your application's
 * actual schema, then regenerate the migration with `pnpm db:generate` and
 * apply it to D1 with `pnpm db:push`.
 */
export const users = sqliteTable("users", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  email: text("email", { length: 255 }).notNull().unique(),
  name: text("name", { length: 100 }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(() => Date.now()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(() => Date.now()),
});
