import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getSourceDescriptors, getSourceEntry, getFromSource } from '@/server/upstream';
import type { SourceId } from '@/client/federation/source';

export const prerender = false;
export const GET: APIRoute = async ({ params }) => {
  if (!getSourceDescriptors().some((s) => s.id === params.source))
    return new Response('Unknown or unconfigured source', { status: 404 });
  if (!z.string().uuid().safeParse(params.id).success)
    return new Response('Invalid opportunity ID', { status: 400 });
  try {
    const opportunity = await getFromSource(getSourceEntry(params.source as SourceId)!, params.id!);
    if (!opportunity) return new Response('Opportunity not found', { status: 404 });
    return Response.json(opportunity, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return new Response('Grant source unavailable', { status: 502 });
  }
};
