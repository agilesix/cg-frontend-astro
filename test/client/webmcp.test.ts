import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createContracts } from '@/client/webmcp/contracts';
import { createSiteTools } from '@/client/webmcp/tools';
import { modelContext, registerTools } from '@/client/webmcp/register';
import { createSearchRefresh } from '@/client/searchRefresh';
import { SORT_OPTIONS } from '@/client/searchOptions';
import {
  query,
  filters,
  activeTab,
  sortBy,
  sortOrder,
  pagesByTab,
  pageSize,
  urlParams,
  getPage,
} from '@/stores/searchStore';
import { sourceState, visibleItems } from '@/stores/resultsStore';
import { resultCache } from '@/client/federation/cache';

const sources = [
  { id: 'pa' as const, label: 'Pennsylvania' },
  { id: 'federal' as const, label: 'Federal' },
];
const response = (items: unknown[] = []) =>
  Response.json({ items, total: items.length, dataAsOf: null });
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
beforeEach(() => {
  query.set('');
  filters.set({ status: ['open'] });
  activeTab.set('pa');
  sortBy.set('keyDates.closeDate');
  sortOrder.set('asc');
  pageSize.set(25);
  pagesByTab.set({ pa: 1, federal: 1, california: 1, washington: 1 });
  for (const id of ['pa', 'federal', 'california', 'washington'] as const) {
    sourceState.set({
      ...sourceState.get(),
      [id]: { items: [], total: 0, loading: false, error: null, dataAsOf: null },
    });
  }
  resultCache.clear();
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('site input contracts', () => {
  const contracts = createContracts(['pa', 'federal']);
  it.each([
    { source: 'california' },
    { source: 'ca' },
    { extra: true },
    { filters: { extra: [] } },
    { filters: { status: ['invalid'] } },
    { filters: { closeDate: { start: '2026-02-30' } } },
    { filters: { closeDate: { start: '2026-09-02', end: '2026-09-01' } } },
    { filters: { funding: { min: 2, max: 1 } } },
    { filters: { funding: { min: -1 } } },
    { page: 0 },
    { page: 41 },
    { page: 1.5 },
    { query: 'x'.repeat(501) },
    { sort: 'arbitrary:asc' },
  ])('rejects invalid input %j', (input) => {
    expect(contracts.search.safeParse(input).success).toBe(false);
  });
  it('advertises exactly the sorts shared by the manual control', () => {
    expect(contracts.searchJson.properties.sort.enum).toEqual(
      SORT_OPTIONS.map(({ value }) => value),
    );
    for (const { value } of SORT_OPTIONS)
      expect(contracts.search.safeParse({ sort: value }).success).toBe(true);
  });
});

describe('registration', () => {
  it('detects a top-level host but refuses a frame even when the API exists', () => {
    const context = { registerTool: vi.fn() };
    Object.defineProperty(document, 'modelContext', { configurable: true, value: context });
    try {
      expect(modelContext()).toBe(context);
      vi.stubGlobal('window', { top: {} });
      expect(modelContext()).toBeUndefined();
    } finally {
      Reflect.deleteProperty(document, 'modelContext');
    }
  });

  it('can clean up after asynchronous registration finishes following page disposal', async () => {
    const pending = deferred<void>();
    const context = { registerTool: vi.fn(() => pending.promise), unregisterTool: vi.fn() };
    const registration = registerTools(
      context,
      createSiteTools(sources, async () => {}),
    );
    pending.resolve();
    const cleanup = await registration;
    cleanup();
    expect(context.unregisterTool).toHaveBeenCalledTimes(4);
  });

  it('feature-detects unsupported browsers without registration', async () => {
    expect(modelContext()).toBeUndefined();
    const cleanup = await registerTools(
      undefined,
      createSiteTools(sources, async () => {}),
    );
    expect(() => cleanup()).not.toThrow();
  });
  it('registers only the four first-slice tools and cleans up once', async () => {
    const context = { registerTool: vi.fn(), unregisterTool: vi.fn() };
    const cleanup = await registerTools(
      context,
      createSiteTools(sources, async () => {}),
    );
    expect(context.registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      'list_sources',
      'get_search_state',
      'search_opportunities',
      'get_opportunity',
    ]);
    cleanup();
    cleanup();
    expect(context.unregisterTool).toHaveBeenCalledTimes(4);
  });
  it('rolls back earlier registrations after a partial failure', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const context = {
      registerTool: vi
        .fn()
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('unsupported')),
      unregisterTool: vi.fn(),
    };
    const cleanup = await registerTools(
      context,
      createSiteTools(sources, async () => {}),
    );
    cleanup();
    expect(context.unregisterTool).toHaveBeenCalledExactlyOnceWith('list_sources');
  });
});

describe('tools use live search state', () => {
  function setup() {
    const refresh = createSearchRefresh(sources.map(({ id }) => id));
    const tools = createSiteTools(sources, refresh.refresh);
    return {
      refresh,
      call: (name: string, input: unknown = {}) =>
        tools.find((tool) => tool.name === name)!.execute(input),
    };
  }
  it('validates before store mutation or network effects', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { call } = setup();
    const before = urlParams.get();
    expect(await call('search_opportunities', { query: 'changed', page: 0 })).toMatchObject({
      status: 'error',
    });
    expect(await call('get_opportunity', { source: 'pa', id: '../bad' })).toMatchObject({
      status: 'error',
    });
    expect(urlParams.get()).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('coalesces ordinary subscriptions and tool mutations, returning the same sorted visible page', async () => {
    const items = ['100', '20', '300'].map((amount) => ({
      id: String(amount),
      funding: { maxAwardAmount: { amount } },
    }));
    const fetch = vi.fn<typeof globalThis.fetch>(async () => response(items));
    vi.stubGlobal('fetch', fetch);
    const { refresh, call } = setup();
    const unsubscribe = urlParams.listen(() => {
      void refresh.refresh();
    });
    pageSize.set(2);
    try {
      const result = await call('search_opportunities', {
        query: 'funding',
        filters: {},
        sort: 'funding.maxAwardAmount.amount:asc',
        page: 2,
      });
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        status: 'success',
        query: 'funding',
        filters: {},
        page: 2,
        total: 3,
        opportunities: [{ id: '300' }],
      });
      expect(result).toMatchObject({ opportunities: visibleItems.get() });
      expect(JSON.parse(fetch.mock.calls[0]![1]!.body as string)).toEqual({
        query: 'funding',
        filters: {},
      });
      expect(await call('get_search_state')).toMatchObject({
        query: 'funding',
        page: 2,
        opportunities: visibleItems.get(),
      });
    } finally {
      unsubscribe();
      refresh.dispose();
    }
  });
  it('omitted inputs preserve manual criteria; source-only restores and clamps its page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response([{ id: 'one' }])),
    );
    query.set('manual');
    filters.set({ agency: ['Example'] });
    pagesByTab.set({ ...pagesByTab.get(), federal: 8 });
    const { call } = setup();
    expect(await call('search_opportunities', { source: 'federal' })).toMatchObject({
      status: 'success',
      source: 'federal',
      query: 'manual',
      filters: { agency: ['Example'] },
      page: 1,
    });
    expect(getPage()).toBe(1);
  });
  it('reports active failure and preserves other source success without false empty success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/pa/') ? new Response('', { status: 502 }) : response([{ id: 'federal' }]),
      ),
    );
    const { call } = setup();
    expect(await call('search_opportunities')).toMatchObject({
      status: 'error',
      total: null,
      opportunities: [],
      sources: [
        { id: 'pa', total: null },
        { id: 'federal', total: 1 },
      ],
    });
  });
  it('refuses concurrent calls and marks A→B→A manual edits superseded', async () => {
    const pending = deferred<Response>();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => pending.promise),
    );
    const { call } = setup();
    const first = call('search_opportunities', { query: 'A' });
    await Promise.resolve();
    expect(await call('search_opportunities', { query: 'second' })).toMatchObject({
      status: 'error',
    });
    expect(query.get()).toBe('A');
    query.set('B');
    query.set('A');
    pending.resolve(response([{ id: 'a' }]));
    expect(await first).toMatchObject({ status: 'superseded' });
  });
  it('reads details without changing visible state', async () => {
    const id = '11111111-1111-4111-8111-111111111111';
    const fetch = vi.fn<typeof globalThis.fetch>(async () => Response.json({ id }));
    vi.stubGlobal('fetch', fetch);
    const before = urlParams.get();
    const { call } = setup();
    expect(await call('get_opportunity', { source: 'pa', id })).toMatchObject({
      source: 'pa',
      opportunity: { id },
    });
    expect(fetch.mock.calls[0]![0]).toBe(`/api/sources/pa/opportunities/${id}`);
    expect(urlParams.get()).toBe(before);
  });
  it('does not dispatch a queued refresh after disposal', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const { refresh } = setup();
    const pending = refresh.refresh();
    refresh.dispose();
    await pending;
    expect(fetch).not.toHaveBeenCalled();
  });
});
