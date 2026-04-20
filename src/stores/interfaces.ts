import type { ActiveFilters, SortOrder } from '@/client/types';
import type { SourceId, Tagged } from '@/client/federation/source';
import type { FilterConfig } from '@/types/portal';

export interface ReadableStore<T> {
  subscribe(run: (value: T) => void): () => void;
  get(): T;
}

export interface WritableStore<T> extends ReadableStore<T> {
  set(value: T): void;
}

export interface ISearchBarStore {
  query: WritableStore<string>;
  submit: () => void;
}

export interface ISourceToggleStore {
  enabledSources: WritableStore<Set<SourceId>>;
  availableSources: ReadableStore<Array<{ id: SourceId; label: string }>>;
}

export interface IFilterPanelStore {
  filters: WritableStore<ActiveFilters>;
  filterConfig: ReadableStore<readonly FilterConfig[]>;
  rawItems: ReadableStore<Array<Tagged<unknown>>>;
  clearFilters: () => void;
}

export interface IActiveFiltersStore {
  filters: WritableStore<ActiveFilters>;
  query: WritableStore<string>;
  filterConfig: ReadableStore<readonly FilterConfig[]>;
  clearAll: () => void;
}

export interface ISortStore {
  sortBy: WritableStore<string>;
  sortOrder: WritableStore<SortOrder>;
  total: ReadableStore<number>;
}

export interface IResultsListStore {
  visibleItems: ReadableStore<Array<Tagged<unknown>>>;
  loading: ReadableStore<boolean>;
  cacheHit: ReadableStore<boolean>;
  bySource: ReadableStore<
    Record<SourceId, { total: number; dataAsOf: string | null; error?: Error }>
  >;
}

export interface IPaginationStore {
  page: WritableStore<number>;
  totalPages: ReadableStore<number>;
  pageSize: ReadableStore<number>;
}

export interface IFreshnessStripStore {
  bySource: ReadableStore<
    Record<SourceId, { total: number; dataAsOf: string | null; error?: Error }>
  >;
  refresh: () => void;
}
