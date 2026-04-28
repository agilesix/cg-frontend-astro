# cg-astro — Federated CommonGrants portal

Astro + Svelte frontend that searches grant opportunities across multiple
CommonGrants-compliant APIs in one experience. Ships with Pennsylvania (via
`cg-api-pa`) and Federal (via `api.simpler.grants.gov`) as first-class sources.

## What it does

- One search bar, one filter set, **per-source tabs**. Switching tabs swaps the
  active result set without losing the current query or filters.
- A unified semantic filter model — `Status`, `Close date`, `Maximum award`,
  `Category`, `Agency`. Each filter declares per-source field paths in
  `portal.config.ts`; filters not mapped for the active source are hidden in
  that tab.
- **All filter logic lives server-side.** The browser POSTs
  `{query, filters}` to `/api/sources/[source]/search` and gets back an
  already-filtered list. The Worker sends `query` + `statuses` to the SDK
  (the only fields its high-level `.search()` exposes today) and applies
  every other filter in memory. Browser code does zero predicate work.
- **Per-tab cache** in localStorage with a 30-minute TTL and cross-tab live
  sync via the `storage` event — opening a second tab on the same query
  reuses the first tab's entry, and "↻ Refresh" in one tab invalidates the
  others.
- Opportunity detail pages are server-rendered; URL is
  `/opportunities/{source}/{id}` so each request routes to the right
  upstream client.

```
┌─────────────────── Cloudflare Worker ────────────────────┐
│                                                          │
│  Browser  (Svelte islands + nanostores)                  │
│    SearchBar   Tabs            ── reads/writes ─┐        │
│    FilterPanel ResultsList                      │        │
│    ActiveFilters Pagination     resultCache     │        │
│    SortControls FreshnessStrip  (localStorage,  │        │
│    UrlSync                       30-min TTL,    │        │
│                                  cross-tab sync)│        │
│                       │                                  │
│                       ▼                                  │
│  SSR routes                                              │
│    /search                                               │
│    /opportunities/[source]/[id]                          │
│    /api/sources/[source]/search                          │
│                       │                                  │
│                       ▼                                  │
│  Server modules                                          │
│    server/upstream.ts        — SDK Client per source     │
│    server/filterPushdown.ts  — pushdown vs local split   │
└───────────────────────┼──────────────────────────────────┘
                        ▼
        ┌───────────────┴───────────────┐
        ▼                               ▼
  cg-api-pa (PA)        api.simpler.grants.gov (Federal)
```

## Prerequisites

- **Node 22** (`.nvmrc` / `.node-version` pin this; use `nvm use` if you have nvm).
- **pnpm 10** (enable with `corepack enable` if needed).
- A running or deployed [`cg-api-pa`](../cg-api-pa/) instance, and/or access to
  `https://api.simpler.grants.gov`.

## Local development

```sh
# Terminal A (optional — if you want the full stack locally)
cd ../cg-api-pa
pnpm install
pnpm run dev   # wrangler dev on http://localhost:8787

# Terminal B
cd cg-astro
pnpm install
cp .env.example .env
# Edit .env:
#   PUBLIC_PA_API_URL=http://localhost:8787    (or a deployed PA URL)
#   PUBLIC_FEDERAL_API_URL=https://api.simpler.grants.gov
#   FEDERAL_API_TOKEN=<your-grants.gov-key>    (optional)
pnpm run dev   # astro dev on http://localhost:4321
```

Open `http://localhost:4321/search`. Tabs at the top switch between
Pennsylvania and Federal; the URL syncs the active tab via `?tab=pa|federal`.

## Checks

| Command                 | What it does                                         |
| :---------------------- | :--------------------------------------------------- |
| `pnpm run dev`          | Dev server (`localhost:4321`)                        |
| `pnpm run build`        | Production build → `./dist/`                         |
| `pnpm run check:types`  | `astro check` + `tsc --noEmit`                       |
| `pnpm run check:lint`   | ESLint (TS + Svelte)                                 |
| `pnpm run check:format` | Prettier (`--check`)                                 |
| `pnpm run format`       | Prettier write                                       |
| `pnpm run test`         | Vitest                                               |
| `pnpm run ci`           | All of the above (what CI runs)                      |
| `pnpm run copy-assets`  | Re-stage USWDS CSS/fonts (`prepare` runs on install) |

## Environment variables

| Name                     | Required | Purpose                                                  |
| :----------------------- | :------- | :------------------------------------------------------- |
| `PUBLIC_PA_API_URL`      | optional | Base URL of the PA CommonGrants API (build-time inlined) |
| `PUBLIC_FEDERAL_API_URL` | optional | Base URL of the federal CommonGrants API (build-time)    |
| `FEDERAL_API_TOKEN`      | optional | API key for the federal API; server-only, never bundled  |

`PUBLIC_*` URLs are public so Vite inlines them at build time via
`import.meta.env`. `FEDERAL_API_TOKEN` is a secret and stays in `process.env`
— it's resolved at runtime from the Worker's secret bindings.

At least one URL must be set for the search page to return results. Both
unset is allowed at build time but produces an empty results list at runtime.

## Deployment

- `.github/workflows/ci.yml` runs typecheck, lint, format, test, audit, and
  build on every PR.
- `.github/workflows/cd-production.yml` deploys to Cloudflare on merges to
  `main` (bound to the `production` GitHub Environment).
- `.github/workflows/cd-preview.yml` deploys a per-PR preview Worker (bound
  to the `preview` GitHub Environment) and tears it down on PR close.

Required repo secrets:

- `CLOUDFLARE_API_TOKEN` (Workers:Edit)
- `CLOUDFLARE_ACCOUNT_ID`
- `FEDERAL_API_TOKEN` (optional — only if hitting the federal API)

Required repo variables:

- `PUBLIC_PA_API_URL`
- `PUBLIC_FEDERAL_API_URL`

To point preview deploys at staging upstreams without touching production,
override the same variable / secret names inside the `preview` GitHub
Environment.

## Architecture notes

- **Svelte 5 islands + nanostores.** Every island subscribes directly to the
  shared atoms — no shared context or root coordinator. See `src/stores/*.ts`.
- **Server-side federation.** The browser POSTs `{query, filters}` to
  `/api/sources/[source]/search` and receives an already-filtered list.
  All predicate logic lives in `src/server/filterPushdown.ts` — a single
  migration seam where rows flip from "applied locally in the Worker" to
  "pushed down via the SDK" as the spec/SDK gain support for more parameters.
- **SDK clients, per source.** `src/server/upstream.ts` constructs one
  `@common-grants/sdk/client` `Client` per configured upstream and uses its
  high-level `.search()` / `.get()` methods. Adding a new source is a
  single block in `buildSourceRegistry()` — register a `Client`, add a
  `SourceId`, and tabs / filters / the API endpoint pick it up automatically.
- **Cache key spans the full filter set.** Because the server applies every
  filter, the key is `{sourceId, query, filters}`. Sort and pagination are
  client-side and never invalidate. Persisted to localStorage with cross-tab
  `storage`-event sync; see `src/client/federation/cache.ts`.
- **USWDS CSS** is staged into `src/styles/` and `public/uswds/` by
  `scripts/copy-uswds-assets.mjs` because the npm package doesn't export its
  compiled CSS via its `exports` map.

See `docs/adr/` for longer-form decisions.
