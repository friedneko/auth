/// <reference types="@cloudflare/workers-types" />

/**
 * Project-specific Cloudflare binding types.
 *
 * `@cloudflare/workers-types` ships an intentionally-empty ambient
 * `Cloudflare.Env` interface; binding types are meant to be merged here (the
 * same shape `wrangler types` generates). Keep this in sync with the
 * binding configuration in `wrangler.toml`.
 *
 * - `DB`          — Cloudflare D1 (SQLite) for persistent storage
 * - `AUTH_KV`     — KV namespace for caching signing keys (D1 is source of truth)
 *
 * The `D1Database` and `KVNamespace` types are ambient globals provided by
 * `@cloudflare/workers-types` (loaded via the reference directive above).
 */
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    AUTH_KV?: KVNamespace;
  }
}
