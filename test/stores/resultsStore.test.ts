import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import {
  rawItems,
  filteredSorted,
  total,
  totalPagesCount,
  visibleItems,
  fetchResults,
} from '@/stores/resultsStore';
import {
  query,
  filters,
  enabledSources,
  page,
  pageSize,
  sortBy,
  sortOrder,
} from '@/stores/searchStore';
import { resultCache } from '@/client/federation/cache';
import type { Source, Tagged } from '@/client/federation/source';

function reset(): void {
  query.set('');
  filters.set({});
  enabledSources.set(['pa', 'federal']);
  sortBy.set('keyDates.closeDate');
  sortOrder.set('asc');
  page.set(1);
  pageSize.set(25);
  rawItems.set([]);
  resultCache.clear();
  sessionStorage.clear();
}

const trivialSchema = z.object({
  id: z.string(),
  keyDates: z.object({ closeDate: z.string() }),
});

function makeSource(id: 'pa' | 'federal', post: ReturnType<typeof vi.fn>): Source {
  return {
    id,
    label: id,
    enabled: true,
    schema: trivialSchema,
    client: { post } as unknown as Source['client'],
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('pipeline store computations', () => {
  beforeEach(reset);

  const items: Array<Tagged<{ id: string; keyDates: { closeDate: string } }>> = [
    { _source: 'pa', id: 'a', keyDates: { closeDate: '2026-06-01' } },
    { _source: 'federal', id: 'b', keyDates: { closeDate: '2026-03-15' } },
    { _source: 'pa', id: 'c', keyDates: { closeDate: '2026-12-01' } },
  ];

  it('filteredSorted returns items in sort order', () => {
    rawItems.set(items);
    sortBy.set('keyDates.closeDate');
    sortOrder.set('asc');
    expect(filteredSorted.get().map((i) => (i as unknown as { id: string }).id)).toEqual([
      'b',
      'a',
      'c',
    ]);
  });

  it('total and totalPagesCount reflect the post-filter list', () => {
    rawItems.set(items);
    pageSize.set(2);
    expect(total.get()).toBe(3);
    expect(totalPagesCount.get()).toBe(2);
  });

  it('visibleItems paginates correctly', () => {
    rawItems.set(items);
    pageSize.set(2);
    page.set(1);
    expect(visibleItems.get().map((i) => (i as unknown as { id: string }).id)).toEqual(['b', 'a']);
    page.set(2);
    expect(visibleItems.get().map((i) => (i as unknown as { id: string }).id)).toEqual(['c']);
  });
});

describe('fetchResults', () => {
  beforeEach(reset);

  it('calls searchAll on cache miss and populates atoms', async () => {
    const paPost = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ id: 'x', keyDates: { closeDate: '2026-06-01' } }],
        paginationInfo: { totalItems: 1 },
      }),
    );
    await fetchResults([makeSource('pa', paPost)]);
    expect(paPost).toHaveBeenCalledTimes(1);
    expect(rawItems.get()).toHaveLength(1);
  });

  it('hits cache on second identical call without invoking searchAll', async () => {
    const paPost = vi.fn().mockResolvedValue(
      jsonResponse({
        items: [{ id: 'x', keyDates: { closeDate: '2026-06-01' } }],
        paginationInfo: { totalItems: 1 },
      }),
    );
    const src = makeSource('pa', paPost);
    enabledSources.set(['pa']);
    await fetchResults([src]);
    expect(paPost).toHaveBeenCalledTimes(1);
    await fetchResults([src]);
    expect(paPost).toHaveBeenCalledTimes(1);
  });

  it('refetches when server-side filter changes', async () => {
    const paPost = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [], paginationInfo: { totalItems: 0 } }));
    const src = makeSource('pa', paPost);
    enabledSources.set(['pa']);
    await fetchResults([src]);
    filters.set({ status: ['open'] });
    await fetchResults([src]);
    expect(paPost).toHaveBeenCalledTimes(2);
  });

  it('does NOT refetch when only a client-side filter changes (cache key stable)', async () => {
    const paPost = vi
      .fn()
      .mockResolvedValue(jsonResponse({ items: [], paginationInfo: { totalItems: 0 } }));
    const src = makeSource('pa', paPost);
    enabledSources.set(['pa']);
    await fetchResults([src]);
    filters.set({ paCategory: ['Agriculture'] });
    await fetchResults([src]);
    expect(paPost).toHaveBeenCalledTimes(1);
  });
});
