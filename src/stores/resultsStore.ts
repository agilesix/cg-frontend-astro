import { atom, computed } from 'nanostores';
import type { Source, SourceId, Tagged } from '@/client/federation/source';
import type { OppSortBy } from '@common-grants/sdk/types';
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

export type BySource = Record<SourceId, { total: number; dataAsOf: string | null; error?: Error }>;

const EMPTY_BY_SOURCE: BySource = {
  pa: { total: 0, dataAsOf: null },
  federal: { total: 0, dataAsOf: null },
};

export const rawItems = atom<Array<Tagged<unknown>>>([]);
export const bySource = atom<BySource>(EMPTY_BY_SOURCE);
export const loading = atom<boolean>(false);
export const cacheHit = atom<boolean>(false);

/** Client-side filter + sort; produces the full post-pipeline list. */
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

export async function fetchResults(sources: Source[]): Promise<void> {
  const enabled = new Set(enabledSources.get());
  const active = sources.filter((s) => enabled.has(s.id));
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
    const serverFilters = toOppFilters(filters.get(), portalConfig.filters);
    const result = await searchAll(active, {
      search: query.get(),
      filters: serverFilters,
      sorting: { sortBy: sortBy.get() as OppSortBy, sortOrder: sortOrder.get() },
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

export function clearCacheAndRefetch(sources: Source[]): Promise<void> {
  resultCache.clear();
  return fetchResults(sources);
}
