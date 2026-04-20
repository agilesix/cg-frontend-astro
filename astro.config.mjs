// @ts-check
import { defineConfig } from 'astro/config';
import svelte from '@astrojs/svelte';
import cloudflare from '@astrojs/cloudflare';

// Hybrid rendering: most pages are static (default in Astro 5+); the
// opportunity detail page opts into SSR via `export const prerender = false`.
// An adapter is required for any SSR route — Cloudflare Pages here.
export default defineConfig({
  output: 'static',
  // platformProxy runs the dev server under a Miniflare-backed Workers runtime
  // so Svelte's `node:async_hooks` import resolves the same way it will in
  // production. Without it, Vite warns about unexpected Node.js imports in the
  // ssr environment.
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [svelte()],
  vite: {
    resolve: {
      alias: {
        '@': new URL('./src', import.meta.url).pathname,
      },
    },
  },
});
