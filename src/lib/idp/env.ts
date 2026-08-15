/**
 * Access the Cloudflare Worker environment and project bindings.
 *
 * In Waku's Cloudflare adapter, only *string* env values are mirrored onto
 * `globalThis.__WAKU_SERVER_ENV__`, so we must use the D1 binding from the
 * `cloudflare:workers` module (via `getDbFromEnv` in `@/lib/db/client.ts`)
 * to access the structured D1 database binding.
 */

import { getDbFromEnv } from "@/lib/db/client";
import type { Database } from "@/lib/db/client";

/**
 * Convenience: get a Drizzle database instance from the Cloudflare env.
 */
export async function getDb(): Promise<Database> {
  return getDbFromEnv();
}

/**
 * Returns the issuer URL for OIDC discovery and token signing.
 *
 * The issuer is derived from the request origin so the same Worker can serve
 * multiple environments (dev / staging / prod) without reconfiguration.
 *
 * @param req  The incoming Request.
 */
export function getIssuer(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
