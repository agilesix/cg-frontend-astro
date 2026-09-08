import type { APIRoute } from 'astro';
import type { SourceId } from '@/client/federation/source';
import { getSourceEntry, searchSource, type SourceSearchRequest } from '@/server/upstream';

export const prerender = false;

function isSourceId(v: string | undefined): v is SourceId {
  return v === 'pa' || v === 'federal' || v === 'california' || v === 'washington';
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
  } catch {
    // Upstream errors may include credentials or response bodies. Neither
    // expose them nor disguise an authentication failure as an empty search.
    console.warn(`[${entry.label}] search unavailable`);
    return new Response(JSON.stringify({ error: 'Grant source unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
