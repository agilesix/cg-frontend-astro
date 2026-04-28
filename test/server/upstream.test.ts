import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Client } from '@common-grants/sdk/client';
import type { SourceEntry } from '@/server/upstream';

beforeEach(() => {
  vi.resetModules();
  // URLs flow through `import.meta.env` (Vite inlines `PUBLIC_*` at build);
  // `vi.stubEnv` updates both `process.env` and `import.meta.env` in vitest.
  vi.stubEnv('PUBLIC_PA_API_URL', 'https://pa.example');
  vi.stubEnv('PUBLIC_FEDERAL_API_URL', 'https://federal.example');
  process.env.FEDERAL_API_TOKEN = 'tok';
});

afterEach(() => {
  vi.unstubAllEnvs();
  delete process.env.FEDERAL_API_TOKEN;
});

function makeMockEntry(
  searchImpl: (
    opts: unknown,
  ) => Promise<{ items: unknown[]; paginationInfo?: { totalItems?: number } }>,
): SourceEntry {
  const search = vi.fn(searchImpl);
  return {
    id: 'pa',
    label: 'Pennsylvania',
    client: { opportunities: { search } } as unknown as Client,
  };
}

describe('searchSource', () => {
  it("calls SDK's .search() with pushdown filters and pagination", async () => {
    const search = vi.fn(async () => ({
      items: [{ id: 'x' }],
      paginationInfo: { totalItems: 1 },
    }));
    const entry: SourceEntry = {
      id: 'pa',
      label: 'PA',
      client: { opportunities: { search } } as unknown as Client,
    };

    const { searchSource } = await import('@/server/upstream');
    const result = await searchSource(entry, {
      query: 'agriculture',
      filters: { status: ['open'] },
      pageSize: 50,
    });

    expect(search).toHaveBeenCalledWith({
      query: 'agriculture',
      statuses: ['open'],
      page: 1,
      pageSize: 50,
    });
    expect(result.items).toEqual([{ id: 'x' }]);
    expect(result.total).toBe(1);
    expect(result.dataAsOf).toBeNull();
  });

  it('does not pass `query` when empty', async () => {
    const search = vi.fn(async () => ({ items: [], paginationInfo: { totalItems: 0 } }));
    const entry = makeMockEntry(search);
    const { searchSource } = await import('@/server/upstream');
    await searchSource(entry, { query: '', filters: {} });
    const [args] = search.mock.calls[0] as unknown as [{ query?: string; statuses?: unknown }];
    expect(args).toMatchObject({ query: undefined, statuses: undefined });
  });

  it('applies local filters in memory after the SDK call', async () => {
    // Returns 3 items; closeDate filter narrows to 2.
    const search = vi.fn(async () => ({
      items: [
        { id: 'a', keyDates: { closeDate: '2026-06-15' } },
        { id: 'b', keyDates: { closeDate: '2026-08-15' } },
        { id: 'c', keyDates: { closeDate: '2026-10-15' } },
      ],
      paginationInfo: { totalItems: 3 },
    }));
    const entry = makeMockEntry(search);
    const { searchSource } = await import('@/server/upstream');

    const result = await searchSource(entry, {
      filters: { closeDate: { start: '2026-06-01', end: '2026-09-01' } },
    });

    expect(result.items).toHaveLength(2);
    expect((result.items as Array<{ id: string }>).map((i) => i.id)).toEqual(['a', 'b']);
    expect(result.total).toBe(2);
  });

  it('handles 401/403 from upstream by propagating the error (endpoint catches)', async () => {
    const search = vi.fn(async () => {
      throw new Error('Upstream returned 401');
    });
    const entry = makeMockEntry(search);
    const { searchSource } = await import('@/server/upstream');
    await expect(searchSource(entry, {})).rejects.toThrow(/401/);
  });
});

describe('getFromSource', () => {
  it('returns the SDK result on success', async () => {
    const get = vi.fn(async () => ({ id: 'x', title: 'Hello' }));
    const entry: SourceEntry = {
      id: 'pa',
      label: 'PA',
      client: { opportunities: { get } } as unknown as Client,
    };
    const { getFromSource } = await import('@/server/upstream');
    expect(await getFromSource(entry, 'x')).toEqual({ id: 'x', title: 'Hello' });
  });

  it('returns null on 404 (sniffed from error message)', async () => {
    const get = vi.fn(async () => {
      throw new Error('Upstream returned 404');
    });
    const entry: SourceEntry = {
      id: 'pa',
      label: 'PA',
      client: { opportunities: { get } } as unknown as Client,
    };
    const { getFromSource } = await import('@/server/upstream');
    expect(await getFromSource(entry, 'missing')).toBeNull();
  });

  it('rethrows non-404 errors', async () => {
    const get = vi.fn(async () => {
      throw new Error('Upstream returned 500');
    });
    const entry: SourceEntry = {
      id: 'pa',
      label: 'PA',
      client: { opportunities: { get } } as unknown as Client,
    };
    const { getFromSource } = await import('@/server/upstream');
    await expect(getFromSource(entry, 'x')).rejects.toThrow(/500/);
  });
});

describe('getSourceDescriptors', () => {
  it('returns only configured sources', async () => {
    vi.stubEnv('PUBLIC_FEDERAL_API_URL', '');
    const { getSourceDescriptors } = await import('@/server/upstream');
    expect(getSourceDescriptors()).toEqual([{ id: 'pa', label: 'Pennsylvania' }]);
  });
});
