import { describe, it, expect, beforeEach } from 'vitest';
import {
  query,
  filters,
  activeTab,
  sortBy,
  sortOrder,
  pagesByTab,
  setPage,
  urlParams,
  hydrateStoresFromUrl,
} from '@/stores/searchStore';

function reset(): void {
  query.set('');
  filters.set({});
  activeTab.set('pa');
  sortBy.set('keyDates.closeDate');
  sortOrder.set('asc');
  pagesByTab.set({ pa: 1, federal: 1, california: 1, washington: 1 });
}

describe('urlParams', () => {
  beforeEach(reset);

  it('marks explicitly cleared filters', () => {
    expect(urlParams.get()).toBe('filters=none');
  });

  it('serializes query', () => {
    query.set('agriculture');
    expect(urlParams.get()).toBe('q=agriculture&filters=none');
  });

  it('serializes tab when not default (pa)', () => {
    activeTab.set('federal');
    expect(urlParams.get()).toContain('tab=federal');
  });

  it('omits tab=pa (the default)', () => {
    activeTab.set('pa');
    expect(urlParams.get()).not.toContain('tab=');
  });

  it('serializes sort only when non-default', () => {
    sortBy.set('title');
    sortOrder.set('desc');
    expect(urlParams.get()).toContain('sort=title%3Adesc');
  });

  it('serializes the active tab’s page only when > 1', () => {
    setPage(3);
    expect(urlParams.get()).toContain('page=3');
    setPage(1);
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
});

describe('hydrateStoresFromUrl', () => {
  beforeEach(reset);

  it('round-trips cleared filters without restoring the default status', () => {
    const serialized = urlParams.get();
    filters.set({ status: ['open'] });
    hydrateStoresFromUrl(serialized);
    expect(filters.get()).toEqual({});
  });

  it.each([{ status: [] }, { closeDate: {} }, { funding: {} }])(
    'round-trips empty filter values %j as cleared filters',
    (empty) => {
      filters.set(empty);
      const serialized = urlParams.get();
      expect(serialized).toContain('filters=none');
      filters.set({ status: ['open'] });
      hydrateStoresFromUrl(serialized);
      expect(filters.get()).toEqual({});
    },
  );

  it('round-trips a fully-populated state', () => {
    query.set('grants');
    filters.set({ status: ['open'] });
    activeTab.set('federal');
    sortBy.set('title');
    sortOrder.set('desc');
    setPage(3);
    const serialized = urlParams.get();

    reset();
    hydrateStoresFromUrl(serialized);

    expect(query.get()).toBe('grants');
    expect(filters.get()).toEqual({ status: ['open'] });
    expect(activeTab.get()).toBe('federal');
    expect(sortBy.get()).toBe('title');
    expect(sortOrder.get()).toBe('desc');
    expect(pagesByTab.get().federal).toBe(3);
  });

  it('ignores garbage page values', () => {
    hydrateStoresFromUrl('page=-5');
    expect(pagesByTab.get().pa).toBe(1);
  });

  it('ignores unknown tab values', () => {
    activeTab.set('pa');
    hydrateStoresFromUrl('tab=mars');
    expect(activeTab.get()).toBe('pa');
  });

  it('hydrates Washington as a valid source tab', () => {
    hydrateStoresFromUrl('tab=washington');
    expect(activeTab.get()).toBe('washington');
  });

  it('hydrates date-range filter from split params', () => {
    hydrateStoresFromUrl('closeDate.start=2026-06-01&closeDate.end=2026-12-31');
    expect(filters.get().closeDate).toEqual({ start: '2026-06-01', end: '2026-12-31' });
  });
});
