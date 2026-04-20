# ADR 003 — Per-component store interfaces

## Context

The search page has ~10 Svelte islands that coordinate through shared state:
query, filters, sort, pagination, source selection, fetched results, cache
hit indicator, per-source freshness timestamps, etc. Options considered for
how that state flows:

1. **One root `<SearchRoot>` component** owning all state, passed down via
   slots / props. Familiar React pattern.
2. **Svelte context** (`setContext` / `getContext`) shared from a root island.
3. **Global shared stores** (nanostores) imported directly by each island.
4. **Per-component store interfaces** — each island depends on a small typed
   interface; default implementation is a shared nanostore, but any consumer
   can swap in their own conforming store.

## Decision

Option 4 — see `src/stores/interfaces.ts`.

## Why

- **Islands can't share a root.** Astro's island architecture sends each
  island to the browser as an independent bundle; there is no shared component
  tree. A `<SearchRoot>` wrapping children would either force everything into
  one big island (defeating the point) or not actually wrap anything.
- **Svelte context also requires a shared tree** and so fails for the same
  reason.
- **Direct shared stores** (option 3) are the simplest working option, and
  actually what we ship today — every component imports `query`, `filters`,
  etc. from `@/stores/searchStore`.
- **Per-component interfaces** are the thin layer on top: each component's
  `Props` type also accepts an optional `store?: IFooStore` so consumers can
  inject a replacement without touching the component's internals. The default
  is the shared nanostore; the option exists if needed.

## Trade-off

We pay a little extra typing (one interface per component, even if most
consumers never override) for the optionality. Worth it because the
alternative — "rewrite this component to change its store" — is a pattern we'd
regret the first time a downstream portal wants to share search state with,
e.g., a dashboard above the fold.
