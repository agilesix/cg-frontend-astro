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
#   PA_API_URL=http://localhost:8787    (or a deployed PA URL)
#   FEDERAL_API_URL=https://api.simpler.grants.gov
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

| Name              | Required | Purpose                                  |
| :---------------- | :------- | :--------------------------------------- |
| `PA_API_URL`      | optional | Base URL of the PA CommonGrants API      |
| `FEDERAL_API_URL` | optional | Base URL of the federal CommonGrants API |

At least one must be set for the search page to return results. Both unset is
allowed at build time (static prerender) but produces an empty results list at
runtime.

## Deployment

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format, test, audit, and
build on every PR. CD (`.github/workflows/cd.yml`) deploys to Cloudflare on
merges to `main`.

Required repo secrets:

- `CLOUDFLARE_API_TOKEN` (Workers:Edit)
- `CLOUDFLARE_ACCOUNT_ID`

Required repo variables:

- `PA_API_URL`
- `FEDERAL_API_URL`

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
