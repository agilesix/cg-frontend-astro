# ADR 002 — Component overrides (Starlight-style)

## Status

**Proposed** — not implemented in this phase. The runtime half (store
injection) is in place; the build-time half (virtual module aliases) is not.

## Context

We want consumers of this portal to be able to replace any built-in component
(`OpportunityCard`, `FilterPanel`, `Pagination`, etc.) from their own repo
without forking the codebase. Astro's Starlight docs template is the reference
implementation of this pattern.

## Current state

- Every component lives at a real path under `src/components/`.
- Stores are imported directly; there's no per-component override hook.
- Replacing a component today requires editing the file.

## Target state

Consumers override components in `astro.config.mjs`:

```ts
commonGrantsSearch({
  components: {
    OpportunityCard: './src/components/MyCard.svelte',
    FilterPanel: './src/components/MyFilters.svelte',
    Pagination: false, // disable entirely
  },
});
```

An integration resolves each name to either the default path or the override
via a Vite alias registered in `astro:config:setup`:

```
virtual:commongrants/components/OpportunityCard
  → ./src/components/MyCard.svelte  (if overridden)
  → ./node_modules/@common-grants/astro/components/OpportunityCard.svelte  (default)
```

All internal imports go through the virtual module, so swapping is transparent.

## Why now is too early

- There's exactly one consumer (this repo). Building the plumbing before the
  second consumer exists risks designing the wrong abstraction.
- The store-injection pattern (each component accepts optional store props —
  see `src/stores/interfaces.ts`) already covers most override needs for the
  current shape of work.
- Shipping the components as a standalone `@common-grants/astro` npm package is
  the natural trigger for this work.

## Reference

- Starlight override guide: https://starlight.astro.build/guides/overriding-components/
