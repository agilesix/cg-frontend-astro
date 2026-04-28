import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
import type { Tagged } from '@/client/federation/source';

const ORIGINAL_FETCH = globalThis.fetch;

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

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

beforeEach(reset);
afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('pipeline store computations', () => {
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
  it('calls /api/search on cache miss and populates atoms', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [{ _source: 'pa', id: 'x' }],
        bySource: { pa: { total: 1, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    enabledSources.set(['pa']);
    await fetchResults();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('/api/search');
    expect(rawItems.get()).toHaveLength(1);
  });

  it('hits cache on second identical call (one fetch total)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [{ _source: 'pa', id: 'x' }],
        bySource: { pa: { total: 1, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    enabledSources.set(['pa']);
    await fetchResults();
    await fetchResults();
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('refetches when a server-side filter changes', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [],
        bySource: { pa: { total: 0, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    enabledSources.set(['pa']);
    await fetchResults();
    filters.set({ status: ['open'] });
    await fetchResults();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does NOT refetch when only a client-side filter changes', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({
        items: [],
        bySource: { pa: { total: 0, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    enabledSources.set(['pa']);
    await fetchResults();
    filters.set({ paCategory: ['Agriculture'] });
    await fetchResults();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
