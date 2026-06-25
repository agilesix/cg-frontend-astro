import { atom, computed, onMount } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type { ActiveFilters, DateRangeValue, NumberRangeValue, SortOrder } from '@/client/types';
import type { SourceId } from '@/client/federation/source';
import { portalConfig } from '@/portal.config';
import { cacheKey as buildCacheKey } from '@/client/federation/cache';

export const DEFAULT_PAGE_SIZE = 25;
const VALID_TABS: ReadonlySet<SourceId> = new Set<SourceId>(['pa', 'federal', 'california']);
const DEFAULT_SORT_BY = 'keyDates.closeDate';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

// Plain (no `$` prefix) so Svelte's `$store` auto-subscribe syntax works
// in `.svelte` files without identifier clashes.
export const query = atom<string>('');
// Land on open opportunities by default so a fresh visit doesn't pull in
// thousands of closed records. A bare /search URL keeps this; any shared URL
// with filter params overrides it during hydration.
export const DEFAULT_FILTERS: ActiveFilters = { status: ['open'] };
export const filters = atom<ActiveFilters>({ ...DEFAULT_FILTERS });
export const sortBy = atom<string>(DEFAULT_SORT_BY);
export const sortOrder = atom<SortOrder>(DEFAULT_SORT_ORDER);

/** Page is per-tab — switching tabs restores the tab's last page. */
export const pagesByTab = persistentAtom<Record<SourceId, number>>(
  'cg:pagesByTab',
  { pa: 1, federal: 1, california: 1 },
  {
    encode: JSON.stringify,
    decode: (raw) => {
      try {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const page = (v: unknown) => (typeof v === 'number' && v > 0 ? v : 1);
        return {
          pa: page(parsed.pa),
          federal: page(parsed.federal),
          california: page(parsed.california),
        };
      } catch {
        return { pa: 1, federal: 1, california: 1 };
      }
    },
  },
);

export const pageSize = atom<number>(DEFAULT_PAGE_SIZE);

/** Default to PA; user-driven changes persist across sessions. */
export const activeTab = persistentAtom<SourceId>('cg:activeTab', 'pa', {
  encode: (v) => v,
  decode: (raw) => (VALID_TABS.has(raw as SourceId) ? (raw as SourceId) : 'pa'),
});

/** Convenience: read/write the active tab's page in one place. */
export function getPage(): number {
  return pagesByTab.get()[activeTab.get()] ?? 1;
}
export function setPage(n: number): void {
  pagesByTab.set({ ...pagesByTab.get(), [activeTab.get()]: n });
}

/**
 * Cache key for the active tab. Includes only inputs the server uses to
 * fetch — sort and page are applied client-side over the cached list, so
 * they're excluded.
 */
export const cacheKey = computed([activeTab, query, filters], (tab, q, f) =>
  buildCacheKey(tab, { query: q, filters: f }),
);

/** Serialize shareable state into a URL search string. */
export const urlParams = computed(
  [query, filters, activeTab, sortBy, sortOrder, pagesByTab],
  (q, f, tab, sb, so, pages) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tab !== 'pa') params.set('tab', tab);
    if (sb !== DEFAULT_SORT_BY || so !== DEFAULT_SORT_ORDER) {
      params.set('sort', `${sb}:${so}`);
    }
    const tabPage = pages[tab] ?? 1;
    if (tabPage > 1) params.set('page', String(tabPage));
    for (const [id, value] of Object.entries(f)) {
      if (value == null) continue;
      if (Array.isArray(value)) {
        for (const v of value) params.append(id, v);
      } else if (typeof value === 'object') {
        const dr = value as Partial<DateRangeValue & NumberRangeValue>;
        if ('start' in dr && dr.start) params.set(`${id}.start`, dr.start);
        if ('end' in dr && dr.end) params.set(`${id}.end`, dr.end);
        if ('min' in dr && dr.min != null) params.set(`${id}.min`, String(dr.min));
        if ('max' in dr && dr.max != null) params.set(`${id}.max`, String(dr.max));
      } else if (typeof value === 'string' && value) {
        params.set(id, value);
      }
    }
    return params.toString();
  },
);

export function hydrateStoresFromUrl(search: string): void {
  const params = new URLSearchParams(search);

  if (params.has('q')) query.set(params.get('q') ?? '');
  if (params.has('tab')) {
    const t = params.get('tab') ?? '';
    if (VALID_TABS.has(t as SourceId)) activeTab.set(t as SourceId);
  }
  if (params.has('sort')) {
    const raw = params.get('sort') ?? '';
    const [sb, so] = raw.split(':');
    if (sb) sortBy.set(sb);
    if (so === 'asc' || so === 'desc') sortOrder.set(so);
  }

  const nextFilters: ActiveFilters = {};
  for (const f of portalConfig.filters) {
    if (f.type === 'checkbox-group' || f.type === 'select') {
      const vals = params.getAll(f.id);
      if (vals.length > 0) nextFilters[f.id] = vals;
    } else if (f.type === 'date-range') {
      const start = params.get(`${f.id}.start`) ?? undefined;
      const end = params.get(`${f.id}.end`) ?? undefined;
      if (start || end) nextFilters[f.id] = { start, end };
    } else if (f.type === 'number-range') {
      const minRaw = params.get(`${f.id}.min`);
      const maxRaw = params.get(`${f.id}.max`);
      const min = minRaw != null ? Number(minRaw) : undefined;
      const max = maxRaw != null ? Number(maxRaw) : undefined;
      if (Number.isFinite(min) || Number.isFinite(max)) {
        nextFilters[f.id] = {
          ...(Number.isFinite(min) ? { min } : {}),
          ...(Number.isFinite(max) ? { max } : {}),
        };
      }
    }
  }
  if (Object.keys(nextFilters).length > 0) filters.set(nextFilters);

  // Page hydrates last so it isn't clobbered by reset-on-filter listeners.
  if (params.has('page')) {
    const p = Number(params.get('page'));
    if (Number.isFinite(p) && p > 0) setPage(Math.floor(p));
  }
}

/**
 * Reset the active tab's page to 1 when any input that changes the cache
 * key changes. Other tabs keep their page.
 */
onMount(query, () => {
  const resetActiveTabPage = () => setPage(1);
  const unsubs = [
    query.listen(resetActiveTabPage),
    filters.listen(resetActiveTabPage),
    sortBy.listen(resetActiveTabPage),
    sortOrder.listen(resetActiveTabPage),
  ];
  return () => unsubs.forEach((u) => u());
});

export function clearAllFilters(): void {
  // Reset to the open-only default rather than no status filter, so "Clear
  // all" doesn't re-pull every closed opportunity. Removing the remaining
  // status chip is the explicit path to all statuses.
  filters.set({ ...DEFAULT_FILTERS });
  query.set('');
}
