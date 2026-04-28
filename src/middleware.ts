import { defineMiddleware } from 'astro:middleware';
import { createServerSources } from '@/client';
import type { Source } from '@/client/federation/source';

// Server-side source list, rebuilt once per isolate. Federal is wired with
// the real upstream URL + `Auth.apiKey()` for SSR code; the search-page
// islands build their own browser-side via `createBrowserSources()`, which
// routes federal through `/api/proxy/federal/*` to keep the token off the
// client.
let cached: Source[] | null = null;

export const onRequest = defineMiddleware((context, next) => {
  cached ??= createServerSources();
  context.locals.sources = cached;
  return next();
});
