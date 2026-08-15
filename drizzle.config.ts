import { defineConfig } from "drizzle-kit";

// Local (offline) dev tooling only — `pnpm db:generate`, `pnpm db:studio`, etc.
// — targets a SQLite file so you can iterate without a Cloudflare D1 database.
//
// Production runs on D1 via the `DB` binding (see wrangler.toml) using the
// client in `src/db/client.ts`. Apply the same generated migrations to D1 with
// `pnpm db:push` (or `wrangler d1 execute`).
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: "sqlite://./dev.db",
  },
});
