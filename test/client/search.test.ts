import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { searchAll } from '@/client/federation/search';
import type { Source } from '@/client/federation/source';

const trivialSchema = z.object({ id: z.string() });

function makeSource(
  id: 'pa' | 'federal',
  post: (path: string, body: unknown) => Promise<Response>,
): Source {
  return {
    id,
    label: id === 'pa' ? 'PA' : 'Federal',
    enabled: true,
    schema: trivialSchema,
    client: { post } as unknown as Source['client'],
  };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('searchAll', () => {
  it('fans out to both sources and tags items with _source', async () => {
    const paPost = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { items: [{ id: 'pa-1' }, { id: 'pa-2' }], paginationInfo: { totalItems: 2 } },
          { 'X-Data-As-Of': '2026-04-18T00:00:00Z' },
        ),
      );
    const fedPost = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ id: 'fed-1' }], paginationInfo: { totalItems: 1 } }),
      );

    const result = await searchAll([makeSource('pa', paPost), makeSource('federal', fedPost)], {});

    expect(result.items).toHaveLength(3);
    expect(result.items.filter((i) => i._source === 'pa')).toHaveLength(2);
    expect(result.items.filter((i) => i._source === 'federal')).toHaveLength(1);
    expect(result.bySource.pa?.dataAsOf).toBe('2026-04-18T00:00:00Z');
    expect(result.bySource.federal?.dataAsOf).toBeNull();
  });

  it('tolerates one source failing', async () => {
    const paPost = vi.fn().mockRejectedValue(new Error('boom'));
    const fedPost = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ id: 'fed-1' }], paginationInfo: { totalItems: 1 } }),
      );

    const result = await searchAll([makeSource('pa', paPost), makeSource('federal', fedPost)], {});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?._source).toBe('federal');
    expect(result.bySource.pa?.error?.message).toBe('boom');
    expect(result.bySource.federal?.error).toBeUndefined();
  });

  it('skips malformed items without failing the source', async () => {
    const paPost = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ id: 'ok' }, { wrong: 'shape' }],
        paginationInfo: { totalItems: 2 },
      }),
    );

    const result = await searchAll([makeSource('pa', paPost)], {});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?._source).toBe('pa');
  });

  it('treats 401 as silent skip (no user-visible error, logs warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fedPost = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      );
    const paPost = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ items: [{ id: 'pa-1' }], paginationInfo: { totalItems: 1 } }),
      );

    const result = await searchAll([makeSource('pa', paPost), makeSource('federal', fedPost)], {});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?._source).toBe('pa');
    expect(result.bySource.federal?.error).toBeUndefined();
    expect(result.bySource.federal?.total).toBe(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('treats 403 the same way as 401 (silent skip)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fedPost = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 }));
    const result = await searchAll([makeSource('federal', fedPost)], {});
    expect(result.bySource.federal?.error).toBeUndefined();
    warnSpy.mockRestore();
  });

  it('still surfaces 500 as a real error', async () => {
    const paPost = vi
      .fn()
      .mockResolvedValue(new Response('internal', { status: 500, statusText: 'Internal' }));
    const result = await searchAll([makeSource('pa', paPost)], {});
    expect(result.bySource.pa?.error).toBeDefined();
  });

  it('skips disabled sources', async () => {
    const paPost = vi.fn();
    const source = makeSource('pa', paPost);
    source.enabled = false;
    await searchAll([source], {});
    expect(paPost).not.toHaveBeenCalled();
  });

  it('sends search path, filters, sorting, and pagination in body', async () => {
    const paPost = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [], paginationInfo: { totalItems: 0 } }));

    await searchAll([makeSource('pa', paPost)], {
      search: 'agriculture',
      filters: { status: { operator: 'in', value: ['open'] } },
      sorting: { sortBy: 'keyDates.closeDate', sortOrder: 'asc' },
      pageSize: 50,
    });

    expect(paPost).toHaveBeenCalledWith('/common-grants/opportunities/search', {
      search: 'agriculture',
      filters: { status: { operator: 'in', value: ['open'] } },
      sorting: { sortBy: 'keyDates.closeDate', sortOrder: 'asc' },
      pagination: { page: 1, pageSize: 50 },
    });
  });
});
