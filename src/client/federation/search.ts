import type { OppFilters, OppSorting } from '@common-grants/sdk/types';
import type { Source, SourceId, Tagged } from './source';

export interface FederatedSearchRequest {
  search?: string;
  filters?: OppFilters;
  sorting?: OppSorting;
  pageSize?: number;
}

export interface FederatedSearchResult {
  items: Array<Tagged<unknown>>;
  bySource: Record<SourceId, { total: number; dataAsOf: string | null; error?: Error }>;
}

// The SDK's high-level `client.opportunities.search()` only exposes `statuses`,
// so we drop to `client.post()` to send a full OppFilters body. This also
// preserves the raw Response, letting us read the per-source freshness header.
const SEARCH_PATH = '/common-grants/opportunities/search';

export async function searchAll(
  sources: Source[],
  req: FederatedSearchRequest,
): Promise<FederatedSearchResult> {
  const enabled = sources.filter((s) => s.enabled);

  const results = await Promise.allSettled(
    enabled.map(async (src) => {
      const body = {
        search: req.search || undefined,
        filters: req.filters,
        sorting: req.sorting,
        pagination: { page: 1, pageSize: req.pageSize ?? 100 },
      };
      const res = await src.client.post(SEARCH_PATH, body);
      if (!res.ok) {
        // 401/403 are expected when a source needs credentials we haven't
        // wired up (e.g. api.simpler.grants.gov requires an API key). Log
        // and treat the source as silently absent so the UI doesn't nag the
        // user about something they can't fix.
        if (res.status === 401 || res.status === 403) {
          console.warn(`[${src.label}] ${res.status} ${res.statusText}; skipping this source.`);
          return { source: src, items: [], total: 0, dataAsOf: null };
        }
        const text = await res.text().catch(() => '');
        throw new Error(`${src.label} returned ${res.status}: ${text.slice(0, 200)}`);
      }
      const json = (await res.json()) as {
        items?: unknown[];
        paginationInfo?: { totalItems?: number };
      };
      const rawItems = json.items ?? [];
      const items: unknown[] = [];
      for (const raw of rawItems) {
        // Parse each item against the source's schema; skip malformed entries
        // rather than failing the whole source (the UI still benefits from
        // valid results).
        const parsed = src.schema.safeParse(raw);
        if (parsed.success) items.push(parsed.data);
      }
      return {
        source: src,
        items,
        total: json.paginationInfo?.totalItems ?? items.length,
        dataAsOf: res.headers.get('X-Data-As-Of'),
      };
    }),
  );

  const items: Array<Tagged<unknown>> = [];
  const bySource = {} as FederatedSearchResult['bySource'];

  results.forEach((r, i) => {
    const src = enabled[i]!;
    if (r.status === 'rejected') {
      bySource[src.id] = {
        total: 0,
        dataAsOf: null,
        error: r.reason instanceof Error ? r.reason : new Error(String(r.reason)),
      };
      return;
    }
    const { items: srcItems, total, dataAsOf } = r.value;
    for (const item of srcItems)
      items.push({ ...(item as object), _source: src.id } as Tagged<unknown>);
    bySource[src.id] = { total, dataAsOf };
  });

  return { items, bySource };
}
