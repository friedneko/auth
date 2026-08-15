# Deploying to Cloudflare Workers (Pure SSG)

This project is built for and deployed to **Cloudflare Workers** via the
Waku Cloudflare adapter (`src/waku.server.tsx`) and [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

The Cloudflare adapter is selected automatically when the `CLOUDFLARE`
environment variable is set, so `dev`, `build`, and `preview` are all run with
`CLOUDFLARE=1` to keep local behavior identical to the deployed worker.

## Scripts

| Script                    | What it does                                                               |
| ------------------------- | -------------------------------------------------------------------------- |
| `pnpm dev`                | Runs the Waku dev server with the Cloudflare adapter (live, with HMR).     |
| `pnpm build`              | Generic production build (Node-style).                                     |
| `pnpm deploy:cloudflare`  | Builds for Cloudflare (`CLOUDFLARE=1 waku build`) then `wrangler deploy`.  |
| `pnpm preview:cloudflare` | Builds for Cloudflare and runs it locally in `miniflare` (`wrangler dev`). |

## First-time setup

1. `pnpm install` — installs deps, approves `esbuild`/`workerd` build scripts,
   and auto-enables the tracked git hooks via the `prepare` script.
2. Log in to Wrangler once:
   ```sh
   npx wrangler login
   ```
   (Or set a `CF_API_TOKEN` in your environment for CI.)

## Deploy

```sh
pnpm deploy:cloudflare   # builds the worker + static assets, then deploys
```

This is equivalent to the upstream recipe:

```sh
CLOUDFLARE=1 waku build
wrangler deploy
```

## Local preview of the deployed worker

To preview the exact Cloudflare build (worker + `ASSETS` binding) locally:

```sh
pnpm preview:cloudflare   # = CLOUDFLARE=1 waku build && wrangler dev
```

## How it works

- `src/waku.server.tsx` wires up the Cloudflare adapter with `static: true`
  (pure static-site generation; pages prerendered to `dist/public`).
- The committed `wrangler.toml` points Wrangler at the built worker
  (`main = "./dist/server/index.js"`) and the prerendered assets
  (`assets.directory = "./dist/public"`), with `no_bundle = true` and the
  `nodejs_als` + `nodejs_compat` compatibility flags.
- Waku's Cloudflare build enhancer regenerates `dist/server/wrangler.json`
  and `.wrangler/deploy/config.json` on each build; these (and the `.wrangler/`
  cache) are gitignored as build artifacts.
