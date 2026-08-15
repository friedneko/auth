/// <reference types="@cloudflare/workers-types" />

/**
 * Project-specific Cloudflare binding types.
 *
 * `@cloudflare/workers-types` ships an intentionally-empty ambient
 * `Cloudflare.Env` interface; binding types are meant to be merged here (the
 * same shape `wrangler types` generates). Keep this in sync with the
 * `[[d1_databases]]` bindings in `wrangler.toml`: `DB` is the D1 binding
 * consumed by `getDbFromEnv()` in `src/db/client.ts`.
 *
 * `D1Database` is an ambient global provided by `@cloudflare/workers-types`
 * (loaded via the reference directive above), so it is referenced bare.
 *
 * This file is intentionally a *script* (no top-level import/export): its
 * top-level `declare namespace Cloudflare` merges with the ambient global
 * `Cloudflare` namespace declared by `@cloudflare/workers-types`, extending
 * `Cloudflare.Env` with the `DB` binding.
 */
declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
  }
}
