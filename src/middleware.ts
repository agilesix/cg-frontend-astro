import { defineMiddleware } from 'astro:middleware';
import { createSources } from '@/client';
import type { Source } from '@/client/federation/source';

// Server-side source list, rebuilt once per isolate. The SSR detail page
// reads this from context.locals; the search page's islands build their own
// client-side (see @/client/index.ts for why they can't share this one).
let cached: Source[] | null = null;

export const onRequest = defineMiddleware((context, next) => {
  cached ??= createSources();
  context.locals.sources = cached;
  return next();
});
