import { atom, computed } from 'nanostores';
import type { OppSortBy } from '@common-grants/sdk/types';
import type { SourceId, Tagged } from '@/client/federation/source';
import { searchAll } from '@/client/federation/search';
import { resultCache } from '@/client/federation/cache';
import { applyClientFilters, toOppFilters } from '@/client/filterMapping';
import { sortMerged, paginate, totalPages } from '@/client/federation/pipeline';
import { portalConfig } from '@/portal.config';
import {
  query,
  filters,
  enabledSources,
  sortBy,
  sortOrder,
  page,
  pageSize,
  cacheKey,
} from './searchStore';

export type BySource = Record<
  SourceId,
  { total: number; dataAsOf: string | null; error?: string }
>;

const EMPTY_BY_SOURCE: BySource = {
  pa: { total: 0, dataAsOf: null },
  federal: { total: 0, dataAsOf: null },
};

export const rawItems = atom<Array<Tagged<unknown>>>([]);
export const bySource = atom<BySource>(EMPTY_BY_SOURCE);
export const loading = atom<boolean>(false);
export const cacheHit = atom<boolean>(false);

export const filteredSorted = computed(
  [rawItems, filters, sortBy, sortOrder],
  (items, f, sb, so) => {
    const filtered = applyClientFilters(items, f, portalConfig.filters);
    return sortMerged(filtered, sb, so);
  },
);

export const total = computed(filteredSorted, (items) => items.length);
export const totalPagesCount = computed([filteredSorted, pageSize], (items, ps) =>
  totalPages(items.length, ps),
);
export const visibleItems = computed([filteredSorted, page, pageSize], (items, p, ps) =>
  paginate(items, p, ps),
);

let requestSeq = 0;

export async function fetchResults(): Promise<void> {
  const enabled = [...enabledSources.get()];
  const key = cacheKey.get();

  const cached = resultCache.get(key);
  if (cached) {
    rawItems.set(cached.items);
    bySource.set({ ...EMPTY_BY_SOURCE, ...cached.bySource });
    cacheHit.set(true);
    loading.set(false);
    return;
  }

  const seq = ++requestSeq;
  loading.set(true);
  cacheHit.set(false);
  try {
    const result = await searchAll({
      search: query.get(),
      filters: toOppFilters(filters.get(), portalConfig.filters),
      sorting: { sortBy: sortBy.get() as OppSortBy, sortOrder: sortOrder.get() },
      enabledSources: enabled,
      pageSize: 100,
    });
    if (seq !== requestSeq) return;
    resultCache.set(key, { items: result.items, bySource: result.bySource });
    rawItems.set(result.items);
    bySource.set({ ...EMPTY_BY_SOURCE, ...result.bySource });
  } finally {
    if (seq === requestSeq) loading.set(false);
  }
}

export function clearCacheAndRefetch(): Promise<void> {
  resultCache.clear();
  return fetchResults();
}
