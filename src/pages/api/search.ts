import type { APIRoute } from 'astro';
import { searchAcrossSources, type SearchRequest } from '@/server/upstream';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  let body: SearchRequest;
  try {
    body = (await request.json()) as SearchRequest;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  const result = await searchAcrossSources(body);
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
};
