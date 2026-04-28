import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_FETCH = globalThis.fetch;

function jsonResponse(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  vi.resetModules();
  process.env.PA_API_URL = 'https://pa.example';
  process.env.FEDERAL_API_URL = 'https://federal.example';
  process.env.FEDERAL_API_TOKEN = 'tok';
});

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  delete process.env.PA_API_URL;
  delete process.env.FEDERAL_API_URL;
  delete process.env.FEDERAL_API_TOKEN;
});

describe('searchAcrossSources', () => {
  it('fans out to both sources and tags items with _source', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('pa.example')) {
        return jsonResponse(
          { items: [{ id: 'pa-1' }, { id: 'pa-2' }], paginationInfo: { totalItems: 2 } },
          { 'X-Data-As-Of': '2026-04-27T00:00:00Z' },
        );
      }
      return jsonResponse({ items: [{ id: 'fed-1' }], paginationInfo: { totalItems: 1 } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { searchAcrossSources } = await import('@/server/upstream');
    const result = await searchAcrossSources({});

    expect(result.items).toHaveLength(3);
    expect(result.items.filter((i) => i._source === 'pa')).toHaveLength(2);
    expect(result.items.filter((i) => i._source === 'federal')).toHaveLength(1);
    expect(result.bySource.pa.dataAsOf).toBe('2026-04-27T00:00:00Z');
    expect(result.bySource.federal.dataAsOf).toBeNull();
  });

  it('forwards X-API-Key only to federal', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      jsonResponse({ items: [], paginationInfo: { totalItems: 0 } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { searchAcrossSources } = await import('@/server/upstream');
    await searchAcrossSources({});

    const calls = fetchMock.mock.calls as Array<[string, RequestInit?]>;
    const paCall = calls.find(([u]) => u.includes('pa.example'))!;
    const fedCall = calls.find(([u]) => u.includes('federal.example'))!;
    expect(new Headers(paCall[1]?.headers).get('X-API-Key')).toBeNull();
    expect(new Headers(fedCall[1]?.headers).get('X-API-Key')).toBe('tok');
  });

  it('treats 401 as silent skip (no user-visible error, logs warn)', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('federal.example')) {
        return jsonResponse({ message: 'Unauthorized' }, {}, 401);
      }
      return jsonResponse({ items: [{ id: 'pa-1' }], paginationInfo: { totalItems: 1 } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { searchAcrossSources } = await import('@/server/upstream');
    const result = await searchAcrossSources({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?._source).toBe('pa');
    expect(result.bySource.federal.error).toBeUndefined();
    expect(result.bySource.federal.total).toBe(0);
    expect(warnSpy).toHaveBeenCalledOnce();
    warnSpy.mockRestore();
  });

  it('tolerates one source failing — other source still returns', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes('pa.example')) throw new Error('boom');
      return jsonResponse({ items: [{ id: 'fed-1' }], paginationInfo: { totalItems: 1 } });
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { searchAcrossSources } = await import('@/server/upstream');
    const result = await searchAcrossSources({});

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?._source).toBe('federal');
    expect(result.bySource.pa.error).toBe('boom');
  });

  it('honors enabledSources to skip a configured source', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ items: [], paginationInfo: { totalItems: 0 } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { searchAcrossSources } = await import('@/server/upstream');
    await searchAcrossSources({ enabledSources: ['pa'] });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url] = fetchMock.mock.calls[0] as unknown as [string];
    expect(url).toContain('pa.example');
  });

  it('sends search/filters/sorting/pagination in body', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ items: [], paginationInfo: { totalItems: 0 } }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const { searchAcrossSources } = await import('@/server/upstream');
    await searchAcrossSources({
      search: 'agriculture',
      filters: { status: { operator: 'in', value: ['open'] } },
      sorting: { sortBy: 'keyDates.closeDate', sortOrder: 'asc' },
      enabledSources: ['pa'],
      pageSize: 50,
    });

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body).toEqual({
      search: 'agriculture',
      filters: { status: { operator: 'in', value: ['open'] } },
      sorting: { sortBy: 'keyDates.closeDate', sortOrder: 'asc' },
      pagination: { page: 1, pageSize: 50 },
    });
  });
});

describe('getFromSource', () => {
  it('unwraps `{data}` envelope when present', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ status: 200, message: 'OK', data: { id: 'x', title: 'Hello' } }),
    ) as unknown as typeof fetch;

    const { getFromSource } = await import('@/server/upstream');
    const opp = await getFromSource('pa', 'x');
    expect(opp).toEqual({ id: 'x', title: 'Hello' });
  });

  it('returns the body as-is for raw-opportunity responses', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({ id: 'x', title: 'Hello' }),
    ) as unknown as typeof fetch;

    const { getFromSource } = await import('@/server/upstream');
    const opp = await getFromSource('pa', 'x');
    expect(opp).toEqual({ id: 'x', title: 'Hello' });
  });

  it('returns null on 404', async () => {
    globalThis.fetch = vi.fn(async () =>
      jsonResponse({}, {}, 404),
    ) as unknown as typeof fetch;

    const { getFromSource } = await import('@/server/upstream');
    expect(await getFromSource('pa', 'missing')).toBeNull();
  });
});
