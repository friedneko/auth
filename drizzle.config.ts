import { defineConfig } from "drizzle-kit";

// Local (offline) dev tooling only — `pnpm db:generate`, `pnpm db:studio`, etc.
// — targets a SQLite file so you can iterate without a Cloudflare D1 database.
//
// Production runs on D1 via the `DB` binding (see wrangler.toml) using the
// client in `src/lib/db/client.ts`. Apply the same generated migrations to D1 with
// `pnpm db:push` (or `wrangler d1 execute`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/lib/db/schema.ts",
  out: "./src/lib/db/migrations",
  dbCredentials: {
    url: "file:./dev.db",
  },
});
