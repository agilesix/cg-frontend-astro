# cg-astro — Federated CommonGrants portal

Astro + Svelte frontend that searches grant opportunities across multiple
CommonGrants-compliant APIs in one experience. Ships with Pennsylvania (via
`cg-api-pa`) and Federal (via `api.simpler.grants.gov`) as first-class sources.

## What it does

- One search bar, one filter set, one results list — each card shows a source
  badge (`Pennsylvania` / `Federal`).
- Toggle either source on/off; selection persists in URL + localStorage.
- Server-side filters (`status`, `closeDate`, `funding`) are pushed to each API.
- Client-side filters (e.g. PA `paCategory`, Federal agency) run in-memory
  against the merged list — a backup for fields no API supports server-side.
- Results cached per unique query (5 min TTL + sessionStorage). Toggling a
  client-side filter, changing sort, or paginating never refetches.
- Opportunity detail pages are server-rendered; URL is
  `/opportunities/{source}/{id}` so each request routes to the right API.

```
┌──────────────────────────────────────────────────────────────┐
│                     Cloudflare (Workers)                      │
│                                                               │
│  Static (CDN edge)              SSR                           │
│  / (landing)                    /opportunities/[source]/[id]  │
│  /search (shell)                                              │
│                                                               │
│  Svelte islands  ←─── nanostores ───┐                         │
│  SearchBar                           │                        │
│  SourceToggle                        │                        │
│  FilterPanel                         │                        │
│  ActiveFilters                       │                        │
│  SortControls                        ├── searchAll()          │
│  ResultsList                         │      ├─ PA client      │
│  Pagination                          │      └─ Federal client │
│  FreshnessStrip                      │      ↳ resultCache     │
│  UrlSync                             │                        │
└──────────────────────────────────────┴─────────────────────────┘
             │                                 │
             ▼                                 ▼
    cg-api-pa (PA state)            api.simpler.grants.gov
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

Open `http://localhost:4321/search`. Both source checkboxes are enabled by
default; uncheck either to narrow scope.

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

| Name                     | Required | Purpose                                                     |
| :----------------------- | :------- | :---------------------------------------------------------- |
| `PUBLIC_PA_API_URL`      | optional | Base URL of the PA CommonGrants API (build-time inlined)    |
| `PUBLIC_FEDERAL_API_URL` | optional | Base URL of the federal CommonGrants API (build-time)       |
| `FEDERAL_API_TOKEN`      | optional | API key for the federal API; server-only, never bundled     |

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
- **Cache key on server-side inputs only.** Client-side filter and sort changes
  never invalidate the cache. See `src/client/federation/cache.ts`.
- **SDK client, not custom.** `@common-grants/sdk/client` handles per-source
  HTTP; `searchAll()` drops to `client.post()` to send full `OppFilters` and
  preserve the `X-Data-As-Of` header.
- **USWDS CSS** is staged into `src/styles/` and `public/uswds/` by
  `scripts/copy-uswds-assets.mjs` because the npm package doesn't export its
  compiled CSS via its `exports` map.

See `docs/adr/` for longer-form decisions.
