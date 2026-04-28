/// <reference types="astro/client" />

// Browser-safe env. `PUBLIC_` prefix means Vite inlines these into the
// client bundle at build time. Never put secrets here.
interface ImportMetaEnv {
  readonly PUBLIC_PA_API_URL?: string;
  readonly PUBLIC_FEDERAL_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Server-only env, read via `process.env` at runtime — populated by
// Astro/Vite from `.env.local` in dev, and by Cloudflare Workers bindings
// (`wrangler secret put`) in production. Declaring on `NodeJS.ProcessEnv`
// gives autocomplete + typo-checking. These never get inlined into the
// client bundle because they aren't accessed via `import.meta.env`.
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      FEDERAL_API_URL?: string;
      FEDERAL_API_TOKEN?: string;
    }
  }
}

export {};
