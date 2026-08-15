/**
 * Access the Cloudflare Worker environment and project bindings.
 *
 * In Waku's Cloudflare adapter, only *string* env values are mirrored onto
 * `globalThis.__WAKU_SERVER_ENV__`, so we must use the D1 binding from the
 * `cloudflare:workers` module (via `getDbFromEnv` in `@/lib/db/client.ts`)
 * to access the structured D1 database binding.
 *
 * KV is accessed directly via the `AUTH_KV` global binding exposed by Workers.
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
 * Get the KV namespace from the Cloudflare env, if available.
 * Returns `null` when running outside Workers (e.g. Node dev mode).
 */
export function getKv(): KVNamespace | null {
  // KV is a global binding in Cloudflare Workers
  const global = globalThis as unknown as { AUTH_KV?: KVNamespace };
  if (global.AUTH_KV) {
    return global.AUTH_KV;
  }
  // Fallback: try reading from the env object (Waku Cloudflare adapter mirrors env)
  const env = // eslint-disable-next-line no-underscore-dangle
    (globalThis as { __WAKU_SERVER_ENV__?: Record<string, unknown> }).__WAKU_SERVER_ENV__;
  if (env?.AUTH_KV) {
    return env.AUTH_KV as KVNamespace;
  }
  return null;
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
