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

// Per-tab sequence guard so parallel multi-tab fetches don't clobber each
// other (a single shared counter would drop all-but-the-last response).
const requestSeq: Partial<Record<SourceId, number>> = {};

/** Fetch one source under the current query/filters and write its state. */
export async function fetchTab(id: SourceId): Promise<void> {
  const req = buildRequest();
  const key = buildCacheKey(id, req);
  // `cacheHit` and the loading indicator are about what the user is looking
  // at, so only the active tab drives them.
  const isActive = id === activeTab.get();

  const cached = resultCache.get(key);
  if (cached) {
    patchSource(id, {
      items: cached.items,
      total: cached.total,
      dataAsOf: cached.dataAsOf,
      loading: false,
      error: null,
    });
    if (isActive) cacheHit.set(true);
    return;
  }

  const seq = (requestSeq[id] = (requestSeq[id] ?? 0) + 1);
  patchSource(id, { loading: true, error: null });
  if (isActive) cacheHit.set(false);
  try {
    const result = await searchSource(id, req);
    if (seq !== requestSeq[id]) return;
    resultCache.set(key, {
      items: result.items,
      total: result.total,
      dataAsOf: result.dataAsOf,
    });
    patchSource(id, {
      items: result.items,
      total: result.total,
      dataAsOf: result.dataAsOf,
      loading: false,
    });
  } catch (err) {
    if (seq !== requestSeq[id]) return;
    patchSource(id, {
      loading: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Fetch the currently-active tab. */
export function fetchActiveTab(): Promise<void> {
  return fetchTab(activeTab.get());
}

/**
 * Fetch every configured source so all tab counts reflect the current
 * criteria, not just the active tab's. Runs in parallel; per-source errors
 * are isolated in each source's state.
 */
export async function fetchTabs(ids: SourceId[]): Promise<void> {
  await Promise.all(ids.map((id) => fetchTab(id)));
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
