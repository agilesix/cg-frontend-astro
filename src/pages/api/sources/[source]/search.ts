import type { APIRoute } from 'astro';
import type { SourceId } from '@/client/federation/source';
import { getSourceEntry, searchSource, type SourceSearchRequest } from '@/server/upstream';

export const prerender = false;

function isSourceId(v: string | undefined): v is SourceId {
  return v === 'pa' || v === 'federal' || v === 'california';
}

export const POST: APIRoute = async ({ request, params }) => {
  const sourceParam = params.source;
  if (!isSourceId(sourceParam)) {
    return new Response('Unknown source', { status: 404 });
  }
  const entry = getSourceEntry(sourceParam);
  if (!entry) {
    return new Response('Source is not configured', { status: 503 });
  }

  let body: SourceSearchRequest;
  try {
    body = (await request.json()) as SourceSearchRequest;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  try {
    const result = await searchSource(entry, body);
    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 401/403 from upstream get the silent treatment — same behavior as
    // before. Anything else is a real error worth surfacing.
    if (/\b40[13]\b/.test(message)) {
      console.warn(`[${entry.label}] upstream auth error: ${message}`);
      return new Response(JSON.stringify({ items: [], total: 0, dataAsOf: null }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    console.error(`[${entry.label}] search failed:`, err);
    return new Response(JSON.stringify({ error: message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
