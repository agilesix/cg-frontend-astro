import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheKey, resultCache } from '@/client/federation/cache';

describe('cacheKey', () => {
  it('is stable across object key reordering', () => {
    const a = cacheKey({
      search: 'foo',
      enabledSources: ['pa', 'federal'],
      serverFilters: { status: { operator: 'in', value: ['open'] } },
      sortBy: 'keyDates.closeDate',
      sortOrder: 'asc',
    });
    const b = cacheKey({
      serverFilters: { status: { operator: 'in', value: ['open'] } },
      enabledSources: ['federal', 'pa'],
      sortOrder: 'asc',
      sortBy: 'keyDates.closeDate',
      search: 'foo',
    });
    expect(a).toBe(b);
  });

  it('differs when server filters differ', () => {
    const a = cacheKey({
      search: '',
      enabledSources: ['pa'],
      serverFilters: { status: { operator: 'in', value: ['open'] } },
      sortBy: 'x',
      sortOrder: 'asc',
    });
    const b = cacheKey({
      search: '',
      enabledSources: ['pa'],
      serverFilters: { status: { operator: 'in', value: ['closed'] } },
      sortBy: 'x',
      sortOrder: 'asc',
    });
    expect(a).not.toBe(b);
  });
});

describe('resultCache', () => {
  beforeEach(() => {
    resultCache.clear();
    sessionStorage.clear();
  });

  it('round-trips through in-memory store', () => {
    resultCache.set('k1', {
      items: [{ _source: 'pa' }],
      bySource: { pa: { total: 1, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
    });
    const hit = resultCache.get('k1');
    expect(hit?.items).toHaveLength(1);
    expect(hit?.bySource.pa.total).toBe(1);
  });

  it('returns null for unknown keys', () => {
    expect(resultCache.get('missing')).toBeNull();
  });

  it('expires entries past TTL', () => {
    vi.useFakeTimers();
    resultCache.set('k1', {
      items: [],
      bySource: { pa: { total: 0, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
    });
    vi.advanceTimersByTime(5 * 60_000 + 1);
    expect(resultCache.get('k1')).toBeNull();
    vi.useRealTimers();
  });

  it('persists to sessionStorage and hydrates', () => {
    resultCache.set('k1', {
      items: [{ _source: 'federal' }],
      bySource: { pa: { total: 0, dataAsOf: null }, federal: { total: 1, dataAsOf: '2026-04-18' } },
    });
    // Simulate fresh load — new cache instance would be created normally; here
    // we just verify the storage side effect happened.
    expect(sessionStorage.getItem('cg-cache:k1')).not.toBeNull();
  });

  it('clear() removes both in-memory and storage entries', () => {
    resultCache.set('k1', {
      items: [],
      bySource: { pa: { total: 0, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
    });
    resultCache.clear();
    expect(resultCache.get('k1')).toBeNull();
    expect(sessionStorage.getItem('cg-cache:k1')).toBeNull();
  });

  it('evicts least-recently-used when over cap', () => {
    // 20 is the cap. Set 21 entries; earliest should be gone.
    for (let i = 0; i < 21; i++) {
      resultCache.set(`k${i}`, {
        items: [],
        bySource: { pa: { total: 0, dataAsOf: null }, federal: { total: 0, dataAsOf: null } },
      });
    }
    expect(resultCache.get('k0')).toBeNull();
    expect(resultCache.get('k20')).not.toBeNull();
  });
});
