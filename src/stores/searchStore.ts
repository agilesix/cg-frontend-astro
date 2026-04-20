import { atom, computed, onMount } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import type { ActiveFilters, DateRangeValue, NumberRangeValue, SortOrder } from '@/client/types';
import type { SourceId } from '@/client/federation/source';
import { toOppFilters } from '@/client/filterMapping';
import { portalConfig } from '@/portal.config';
import { cacheKey as buildCacheKey } from '@/client/federation/cache';

export const DEFAULT_PAGE_SIZE = 25;

// Exported atoms intentionally do NOT use the `$`-prefix convention from the
// nanostores docs: Svelte treats `$foo` in a component as store-auto-subscribe
// syntax, which would clash with atom identifiers re-exported into .svelte
// files. Plain names sidestep that parser ambiguity.
export const query = atom<string>('');
export const filters = atom<ActiveFilters>({});
export const sortBy = atom<string>('keyDates.closeDate');
export const sortOrder = atom<SortOrder>('asc');
export const page = atom<number>(1);
export const pageSize = atom<number>(DEFAULT_PAGE_SIZE);

/**
 * Which sources to include in the federated fanout. Backed by localStorage so
 * the selection persists across sessions; also reflected in the URL so links
 * are shareable.
 */
const ALL_SOURCES: SourceId[] = ['pa', 'federal'];

export const enabledSources = persistentAtom<SourceId[]>('cg:enabledSources', ALL_SOURCES, {
  encode: JSON.stringify,
  decode: (raw) => {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((v): v is SourceId => v === 'pa' || v === 'federal');
      }
    } catch {
      // fall through to default
    }
    return ALL_SOURCES;
  },
});

/**
 * Cache key includes only inputs that affect the API query. Client-side
 * filters and pagination are deliberately excluded so toggling them doesn't
 * invalidate the cache entry.
 */
export const cacheKey = computed(
  [query, filters, enabledSources, sortBy, sortOrder],
  (q, f, enabled, sb, so) =>
    buildCacheKey({
      search: q,
      enabledSources: [...enabled],
      serverFilters: toOppFilters(f, portalConfig.filters),
      sortBy: sb,
      sortOrder: so,
    }),
);

const DEFAULT_SORT_BY = 'keyDates.closeDate';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

/** Serialize all shareable state into a URL search string. */
export const urlParams = computed(
  [query, filters, enabledSources, sortBy, sortOrder, page],
  (q, f, enabled, sb, so, pg) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (enabled.length !== ALL_SOURCES.length || !ALL_SOURCES.every((s) => enabled.includes(s))) {
      params.set('sources', [...enabled].sort().join(','));
    }
    if (sb !== DEFAULT_SORT_BY || so !== DEFAULT_SORT_ORDER) {
      params.set('sort', `${sb}:${so}`);
    }
    if (pg > 1) params.set('page', String(pg));
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

/** Hydrate all atoms from a URL search string. Called once on mount. */
export function hydrateStoresFromUrl(search: string): void {
  const params = new URLSearchParams(search);

  // Set everything EXCEPT page first. Each set may trigger the reset-page-to-1
  // listener, which would clobber our page hydration. Setting page last
  // sidesteps this without needing to disable listeners.
  if (params.has('q')) query.set(params.get('q') ?? '');
  if (params.has('sort')) {
    const raw = params.get('sort') ?? '';
    const [sb, so] = raw.split(':');
    if (sb) sortBy.set(sb);
    if (so === 'asc' || so === 'desc') sortOrder.set(so);
  }
  if (params.has('sources')) {
    const raw = params.get('sources') ?? '';
    const parsed = raw
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is SourceId => s === 'pa' || s === 'federal');
    if (parsed.length > 0) enabledSources.set(parsed);
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

  if (params.has('page')) {
    const p = Number(params.get('page'));
    if (Number.isFinite(p) && p > 0) page.set(Math.floor(p));
  }
}

/**
 * When any refetch-triggering input changes, reset to page 1. Paging without a
 * reset is incoherent because the underlying result set just shifted.
 */
onMount(query, () => {
  const resetPage = () => page.set(1);
  const unsubs = [
    query.listen(resetPage),
    filters.listen(resetPage),
    enabledSources.listen(resetPage),
    sortBy.listen(resetPage),
    sortOrder.listen(resetPage),
  ];
  return () => unsubs.forEach((u) => u());
});

export function clearAllFilters(): void {
  filters.set({});
  query.set('');
}
