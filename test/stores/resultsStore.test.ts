import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  sourceState,
  total,
  totalPagesCount,
  visibleItems,
  fetchActiveTab,
  cacheHit,
} from '@/stores/resultsStore';
import {
  query,
  filters,
  activeTab,
  pagesByTab,
  pageSize,
  sortBy,
  sortOrder,
} from '@/stores/searchStore';
import { resultCache } from '@/client/federation/cache';

const ORIGINAL_FETCH = globalThis.fetch;

function reset(): void {
  query.set('');
  filters.set({});
  activeTab.set('pa');
  sortBy.set('keyDates.closeDate');
  sortOrder.set('asc');
  pagesByTab.set({ pa: 1, federal: 1 });
  pageSize.set(25);
  sourceState.set({
    pa: { items: [], total: 0, dataAsOf: null, loading: false, error: null },
    federal: { items: [], total: 0, dataAsOf: null, loading: false, error: null },
  });
  cacheHit.set(false);
  resultCache.clear();
  localStorage.clear();
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

describe('pipeline computeds', () => {
  const items = [
    { id: 'a', keyDates: { closeDate: '2026-06-01' } },
    { id: 'b', keyDates: { closeDate: '2026-03-15' } },
    { id: 'c', keyDates: { closeDate: '2026-12-01' } },
  ];

  function setActiveItems(it: unknown[]): void {
    sourceState.set({
      ...sourceState.get(),
      pa: { items: it, total: it.length, dataAsOf: null, loading: false, error: null },
    });
  }

  it('total reflects the active tab', () => {
    setActiveItems(items);
    expect(total.get()).toBe(3);
  });

  it('totalPagesCount uses pageSize', () => {
    setActiveItems(items);
    pageSize.set(2);
    expect(totalPagesCount.get()).toBe(2);
  });

  it('visibleItems paginates per active tab', () => {
    setActiveItems(items);
    pageSize.set(2);
    pagesByTab.set({ pa: 1, federal: 1 });
    expect((visibleItems.get() as Array<{ id: string }>).map((i) => i.id)).toEqual(['b', 'a']);
    pagesByTab.set({ pa: 2, federal: 1 });
    expect((visibleItems.get() as Array<{ id: string }>).map((i) => i.id)).toEqual(['c']);
  });
});

describe('fetchActiveTab', () => {
  it('hits /api/sources/[active]/search and writes the active tab', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ items: [{ id: 'x' }], total: 1, dataAsOf: null }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    activeTab.set('pa');
    await fetchActiveTab();

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toBe('/api/sources/pa/search');
    expect(sourceState.get().pa.items).toEqual([{ id: 'x' }]);
    expect(cacheHit.get()).toBe(false);
  });

  it('hits cache on a second identical call (one network call total)', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ items: [{ id: 'x' }], total: 1, dataAsOf: null }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchActiveTab();
    await fetchActiveTab();

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(cacheHit.get()).toBe(true);
  });

  it('refetches when active tab switches to a different cache key', async () => {
    const fetchMock = vi.fn(async (url) => {
      const sourceId = String(url).match(/sources\/([a-z]+)/)?.[1];
      return jsonResponse({
        items: [{ id: sourceId }],
        total: 1,
        dataAsOf: null,
      });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    activeTab.set('pa');
    await fetchActiveTab();
    activeTab.set('federal');
    await fetchActiveTab();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sourceState.get().pa.items).toEqual([{ id: 'pa' }]);
    expect(sourceState.get().federal.items).toEqual([{ id: 'federal' }]);
  });

  it('records error on failure', async () => {
    const fetchMock = vi.fn(async () => new Response('boom', { status: 502 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await fetchActiveTab();

    expect(sourceState.get().pa.error).toMatch(/502/);
    expect(sourceState.get().pa.loading).toBe(false);
  });
});
