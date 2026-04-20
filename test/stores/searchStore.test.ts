import { describe, it, expect, beforeEach } from 'vitest';
import {
  query,
  filters,
  enabledSources,
  sortBy,
  sortOrder,
  page,
  urlParams,
  hydrateStoresFromUrl,
} from '@/stores/searchStore';

function reset(): void {
  query.set('');
  filters.set({});
  enabledSources.set(['pa', 'federal']);
  sortBy.set('keyDates.closeDate');
  sortOrder.set('asc');
  page.set(1);
}

describe('urlParams', () => {
  beforeEach(reset);

  it('is empty when all state is default', () => {
    expect(urlParams.get()).toBe('');
  });

  it('serializes query', () => {
    query.set('agriculture');
    expect(urlParams.get()).toBe('q=agriculture');
  });

  it('omits sources when both are enabled (the default)', () => {
    enabledSources.set(['pa', 'federal']);
    expect(urlParams.get()).toBe('');
  });

  it('serializes partial source selection', () => {
    enabledSources.set(['pa']);
    expect(urlParams.get()).toContain('sources=pa');
  });

  it('serializes sort only when non-default', () => {
    sortBy.set('title');
    sortOrder.set('desc');
    expect(urlParams.get()).toContain('sort=title%3Adesc');
  });

  it('serializes page only when > 1', () => {
    page.set(2);
    expect(urlParams.get()).toContain('page=2');
    page.set(1);
    expect(urlParams.get()).not.toContain('page=');
  });

  it('serializes checkbox-group filter values', () => {
    filters.set({ status: ['open', 'forecasted'] });
    const out = urlParams.get();
    expect(out).toContain('status=open');
    expect(out).toContain('status=forecasted');
  });

  it('serializes date-range with start/end', () => {
    filters.set({ closeDate: { start: '2026-01-01', end: '2026-12-31' } });
    const out = urlParams.get();
    expect(out).toContain('closeDate.start=2026-01-01');
    expect(out).toContain('closeDate.end=2026-12-31');
  });

  it('serializes number-range min/max', () => {
    filters.set({ funding: { min: 1000, max: 50000 } });
    const out = urlParams.get();
    expect(out).toContain('funding.min=1000');
    expect(out).toContain('funding.max=50000');
  });
});

describe('hydrateStoresFromUrl', () => {
  beforeEach(reset);

  it('is a no-op for empty search strings', () => {
    hydrateStoresFromUrl('');
    expect(query.get()).toBe('');
    expect(filters.get()).toEqual({});
  });

  it('round-trips a fully-populated state', () => {
    query.set('grants');
    filters.set({ status: ['open'] });
    enabledSources.set(['pa']);
    sortBy.set('title');
    sortOrder.set('desc');
    page.set(3);
    const serialized = urlParams.get();

    reset();
    hydrateStoresFromUrl(serialized);

    expect(query.get()).toBe('grants');
    expect(filters.get()).toEqual({ status: ['open'] });
    expect(enabledSources.get()).toEqual(['pa']);
    expect(sortBy.get()).toBe('title');
    expect(sortOrder.get()).toBe('desc');
    expect(page.get()).toBe(3);
  });

  it('ignores garbage page values', () => {
    hydrateStoresFromUrl('page=-5');
    expect(page.get()).toBe(1);
    hydrateStoresFromUrl('page=abc');
    expect(page.get()).toBe(1);
  });

  it('ignores unknown sort orders', () => {
    hydrateStoresFromUrl('sort=title:sideways');
    expect(sortBy.get()).toBe('title');
    expect(sortOrder.get()).toBe('asc');
  });

  it('hydrates date-range filter from split params', () => {
    hydrateStoresFromUrl('closeDate.start=2026-06-01&closeDate.end=2026-12-31');
    expect(filters.get().closeDate).toEqual({ start: '2026-06-01', end: '2026-12-31' });
  });
});
