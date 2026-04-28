import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cacheKey, resultCache } from '@/client/federation/cache';

function makeEntry(items: unknown[] = []) {
  return { items, total: items.length, dataAsOf: null };
}

describe('cacheKey', () => {
  it('is stable across object key reordering', () => {
    const a = cacheKey('pa', { query: 'foo', filters: { status: ['open'] } });
    const b = cacheKey('pa', { filters: { status: ['open'] }, query: 'foo' });
    expect(a).toBe(b);
  });

  it('produces independent keys per source', () => {
    const a = cacheKey('pa', { query: 'foo' });
    const b = cacheKey('federal', { query: 'foo' });
    expect(a).not.toBe(b);
    expect(a.startsWith('pa:')).toBe(true);
    expect(b.startsWith('federal:')).toBe(true);
  });

  it('differs when filters differ', () => {
    const a = cacheKey('pa', { filters: { status: ['open'] } });
    const b = cacheKey('pa', { filters: { status: ['closed'] } });
    expect(a).not.toBe(b);
  });
});

describe('resultCache', () => {
  beforeEach(() => {
    resultCache.clear();
    localStorage.clear();
  });

  it('round-trips through in-memory store', () => {
    resultCache.set('pa:k1', makeEntry([{ id: 'x' }]));
    const hit = resultCache.get('pa:k1');
    expect(hit?.items).toHaveLength(1);
    expect(hit?.total).toBe(1);
  });

  it('returns null for unknown keys', () => {
    expect(resultCache.get('missing')).toBeNull();
  });

  it('expires entries past TTL (30 min)', () => {
    vi.useFakeTimers();
    resultCache.set('pa:k1', makeEntry());
    vi.advanceTimersByTime(30 * 60_000 + 1);
    expect(resultCache.get('pa:k1')).toBeNull();
    vi.useRealTimers();
  });

  it('persists to localStorage', () => {
    resultCache.set('pa:k1', makeEntry([{ id: 'x' }]));
    expect(localStorage.getItem('cg-cache:pa:k1')).not.toBeNull();
  });

  it('clear() wipes both in-memory and localStorage entries', () => {
    resultCache.set('pa:k1', makeEntry());
    resultCache.set('federal:k2', makeEntry());
    resultCache.clear();
    expect(resultCache.get('pa:k1')).toBeNull();
    expect(localStorage.getItem('cg-cache:pa:k1')).toBeNull();
    expect(localStorage.getItem('cg-cache:federal:k2')).toBeNull();
  });

  it('evicts least-recently-used when over the cap', () => {
    for (let i = 0; i < 21; i++) resultCache.set(`pa:k${i}`, makeEntry());
    expect(resultCache.get('pa:k0')).toBeNull();
    expect(resultCache.get('pa:k20')).not.toBeNull();
  });

  it('onChange does NOT fire for local set/clear (caller already knows)', () => {
    const fn = vi.fn();
    resultCache.onChange(fn);
    resultCache.set('pa:k1', makeEntry([{ id: 'x' }]));
    resultCache.clear();
    expect(fn).not.toHaveBeenCalled();
  });

  it('onChange unsubscribe stops invocations', () => {
    const fn = vi.fn();
    const unsub = resultCache.onChange(fn);
    unsub();
    // Storage events would otherwise notify; unsubscribed listener stays silent.
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'cg-cache:pa:k1',
        newValue: JSON.stringify({ ...makeEntry(), cachedAt: Date.now() }),
      }),
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it('onChange listener throwing does not break others', () => {
    const noisy = vi.fn(() => {
      throw new Error('boom');
    });
    const quiet = vi.fn();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    resultCache.onChange(noisy);
    resultCache.onChange(quiet);
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'cg-cache:pa:k1',
        newValue: JSON.stringify({ ...makeEntry(), cachedAt: Date.now() }),
      }),
    );
    expect(quiet).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });

  it('storage event from another tab hydrates the in-memory map and notifies', () => {
    const fn = vi.fn();
    resultCache.onChange(fn);

    const entry = { items: [{ id: 'remote' }], total: 1, dataAsOf: null, cachedAt: Date.now() };
    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'cg-cache:pa:remote',
        newValue: JSON.stringify(entry),
      }),
    );

    expect(fn).toHaveBeenCalledWith(
      'pa:remote',
      expect.objectContaining({ items: [{ id: 'remote' }] }),
    );
    expect(resultCache.get('pa:remote')?.items).toEqual([{ id: 'remote' }]);
  });

  it('storage event with null newValue (cleared elsewhere) drops the entry', () => {
    resultCache.set('pa:k1', makeEntry());
    const fn = vi.fn();
    resultCache.onChange(fn);

    window.dispatchEvent(new StorageEvent('storage', { key: 'cg-cache:pa:k1', newValue: null }));

    expect(fn).toHaveBeenCalledWith('pa:k1', null);
  });

  it('storage event for an unrelated key is ignored', () => {
    const fn = vi.fn();
    resultCache.onChange(fn);
    window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated', newValue: 'whatever' }));
    expect(fn).not.toHaveBeenCalled();
  });
});
