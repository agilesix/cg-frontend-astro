import { atom, computed } from 'nanostores';
import type { SourceId } from '@/client/federation/source';
import { searchSource } from '@/client/federation/search';
import { resultCache, cacheKey as buildCacheKey } from '@/client/federation/cache';
import { sortMerged, paginate, totalPages } from '@/client/federation/pipeline';
import { activeTab, query, filters, sortBy, sortOrder, pagesByTab, pageSize } from './searchStore';

export interface SourceState {
  items: unknown[];
  total: number;
  dataAsOf: string | null;
  loading: boolean;
  error: string | null;
}

const EMPTY_STATE: SourceState = {
  items: [],
  total: 0,
  dataAsOf: null,
  loading: false,
  error: null,
};

export const sourceState = atom<Record<SourceId, SourceState>>({
  pa: { ...EMPTY_STATE },
  federal: { ...EMPTY_STATE },
  california: { ...EMPTY_STATE },
});

/** True iff the most recent population of the active tab came from cache. */
export const cacheHit = atom<boolean>(false);

/** Convenience: subset of state for the currently visible tab. */
export const activeState = computed([sourceState, activeTab], (states, tab) => states[tab]);

export const loading = computed(activeState, (s) => s.loading);
export const error = computed(activeState, (s) => s.error);

/**
 * Active tab's items, sorted client-side. The server already filtered, so
 * this just runs `sortMerged` over the response list — much smaller than
 * the previous "filter all sources, sort, then paginate" pipeline.
 */
export const sortedItems = computed([activeState, sortBy, sortOrder], (s, sb, so) =>
  sortMerged(s.items, sb, so),
);

export const total = computed(sortedItems, (items) => items.length);

export const totalPagesCount = computed([sortedItems, pageSize], (items, ps) =>
  totalPages(items.length, ps),
);

export const visibleItems = computed(
  [sortedItems, activeTab, pagesByTab, pageSize],
  (items, tab, pages, ps) => paginate(items, pages[tab] ?? 1, ps),
);

// Build the request the server expects, derived from current store state.
function buildRequest() {
  return { query: query.get(), filters: filters.get() };
}

function patchSource(id: SourceId, patch: Partial<SourceState>): void {
  const current = sourceState.get();
  sourceState.set({ ...current, [id]: { ...current[id], ...patch } });
}

let requestSeq = 0;

export async function fetchActiveTab(): Promise<void> {
  const tab = activeTab.get();
  const req = buildRequest();
  const key = buildCacheKey(tab, req);

  const cached = resultCache.get(key);
  if (cached) {
    patchSource(tab, {
      items: cached.items,
      total: cached.total,
      dataAsOf: cached.dataAsOf,
      loading: false,
      error: null,
    });
    cacheHit.set(true);
    return;
  }

  const seq = ++requestSeq;
  patchSource(tab, { loading: true, error: null });
  cacheHit.set(false);
  try {
    const result = await searchSource(tab, req);
    if (seq !== requestSeq) return;
    resultCache.set(key, {
      items: result.items,
      total: result.total,
      dataAsOf: result.dataAsOf,
    });
    patchSource(tab, {
      items: result.items,
      total: result.total,
      dataAsOf: result.dataAsOf,
      loading: false,
    });
  } catch (err) {
    if (seq !== requestSeq) return;
    patchSource(tab, {
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export function clearCacheAndRefetch(): Promise<void> {
  resultCache.clear();
  return fetchActiveTab();
}

// Cross-tab live sync: when another tab populates or invalidates the entry
// we're currently displaying, mirror that change into our state without
// firing a duplicate fetch. Other-key changes are ignored.
resultCache.onChange((key, entry) => {
  const tab = activeTab.get();
  if (key !== buildCacheKey(tab, buildRequest())) return;
  if (entry) {
    patchSource(tab, {
      items: entry.items,
      total: entry.total,
      dataAsOf: entry.dataAsOf,
      loading: false,
      error: null,
    });
    cacheHit.set(true);
  } else {
    // Cache was cleared by another tab — refetch.
    void fetchActiveTab();
  }
});
