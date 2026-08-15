import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "./schema";

export type Database = DrizzleD1Database<typeof schema>;

/**
 * Build a Drizzle client backed by a Cloudflare D1 database binding.
 *
 * @example
 *   const db = getDb(env.DB); // `env` is the worker env (see wrangler.toml)
 *   await db.select().from(schema.users);
 */
export function getDb(d1: D1Database): Database {
  return drizzle(d1, { schema });
}

/**
 * Resolve a Drizzle client from the live Cloudflare Worker environment via
 * the `env` binding of the `cloudflare:workers` module.
 *
 * Note on Waku: its Cloudflare adapter mirrors only *string* env values onto
 * `globalThis.__WAKU_SERVER_ENV__` (`getEnv`), so the `D1Database` object
 * binding cannot be read that way. The binding is reachable here only through
 * the Cloudflare context, which exists inside the deployed worker (and under
 * `pnpm preview:cloudflare`). `pnpm dev` runs a Node simulation and has no D1
 * binding — exercise DB-backed server actions under `pnpm preview:cloudflare`.
 */
export async function getDbFromEnv(): Promise<Database> {
  const { env } = await import(/* @vite-ignore */ "cloudflare:workers");
  const d1 = env.DB;
  if (!d1) {
    throw new Error(
      "D1 'DB' binding not found on the Cloudflare context. Add a " +
        "[[d1_databases]] binding named 'DB' in wrangler.toml.",
    );
  }
  return getDb(d1);
}
