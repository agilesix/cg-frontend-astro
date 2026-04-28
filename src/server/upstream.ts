// Server-only module: fans out CommonGrants requests to configured upstream
// APIs. Reads `process.env` at runtime (no build-time inlining), so the
// browser bundle never sees URLs or tokens.
//
// The browser-side equivalent is just `fetch('/api/search', ...)` — all the
// per-source URL composition, auth header injection, and response merging
// happens here, behind a single same-origin endpoint.

import type { OppFilters, OppSorting } from '@common-grants/sdk/types';
import type { SourceId, Tagged } from '@/client/federation/source';

interface SourceConfig {
  id: SourceId;
  label: string;
  url: string;
  token?: string;
}

export interface SearchRequest {
  search?: string;
  filters?: OppFilters;
  sorting?: OppSorting;
  /** Subset of configured source IDs to query. Defaults to all configured. */
  enabledSources?: SourceId[];
  /** Cap per-source fetch size; we paginate client-side. */
  pageSize?: number;
}

export type BySource = Record<SourceId, { total: number; dataAsOf: string | null; error?: string }>;

export interface SearchResult {
  items: Array<Tagged<unknown>>;
  bySource: BySource;
}

export function getConfiguredSources(): SourceConfig[] {
  const out: SourceConfig[] = [];
  const paUrl = process.env.PA_API_URL ?? process.env.PUBLIC_PA_API_URL;
  if (paUrl) out.push({ id: 'pa', label: 'Pennsylvania', url: paUrl });

  const fedUrl = process.env.FEDERAL_API_URL ?? process.env.PUBLIC_FEDERAL_API_URL;
  if (fedUrl)
    out.push({
      id: 'federal',
      label: 'Federal (Grants.gov)',
      url: fedUrl,
      token: process.env.FEDERAL_API_TOKEN,
    });
  return out;
}

export function getSourceDescriptors(): Array<{ id: SourceId; label: string }> {
  return getConfiguredSources().map(({ id, label }) => ({ id, label }));
}

const EMPTY_BY_SOURCE: BySource = {
  pa: { total: 0, dataAsOf: null },
  federal: { total: 0, dataAsOf: null },
};

function buildHeaders(src: SourceConfig): Headers {
  const h = new Headers({ 'Content-Type': 'application/json' });
  if (src.token) h.set('X-API-Key', src.token);
  return h;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function searchAcrossSources(req: SearchRequest): Promise<SearchResult> {
  const sources = getConfiguredSources().filter(
    (s) => !req.enabledSources || req.enabledSources.includes(s.id),
  );

  const settled = await Promise.allSettled(
    sources.map(async (src) => {
      const res = await fetch(joinUrl(src.url, '/common-grants/opportunities/search'), {
        method: 'POST',
        headers: buildHeaders(src),
        body: JSON.stringify({
          search: req.search || undefined,
          filters: req.filters,
          sorting: req.sorting,
          pagination: { page: 1, pageSize: req.pageSize ?? 100 },
        }),
      });
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          console.warn(`[${src.label}] ${res.status} ${res.statusText}; skipping this source.`);
          return { src, items: [] as unknown[], total: 0, dataAsOf: null as string | null };
        }
        throw new Error(`${src.label} returned ${res.status}`);
      }
      const json = (await res.json()) as {
        items?: unknown[];
        paginationInfo?: { totalItems?: number };
      };
      return {
        src,
        items: json.items ?? [],
        total: json.paginationInfo?.totalItems ?? json.items?.length ?? 0,
        dataAsOf: res.headers.get('X-Data-As-Of'),
      };
    }),
  );

  const items: Array<Tagged<unknown>> = [];
  const bySource: BySource = { ...EMPTY_BY_SOURCE };

  settled.forEach((r, i) => {
    const src = sources[i]!;
    if (r.status === 'rejected') {
      bySource[src.id] = {
        total: 0,
        dataAsOf: null,
        error: r.reason instanceof Error ? r.reason.message : String(r.reason),
      };
      return;
    }
    for (const item of r.value.items) {
      items.push({ ...(item as object), _source: src.id } as Tagged<unknown>);
    }
    bySource[src.id] = { total: r.value.total, dataAsOf: r.value.dataAsOf };
  });

  return { items, bySource };
}

// ==========================================================================
//

/**
 * Single-opportunity fetch. Tolerates either spec-compliant
 * `{status, message, data}` or the raw-opportunity response shape.
 */
export async function getFromSource(sourceId: SourceId, id: string): Promise<unknown | null> {
  const src = getConfiguredSources().find((s) => s.id === sourceId);
  if (!src) throw new Error(`Source ${sourceId} is not configured`);

  const res = await fetch(
    joinUrl(src.url, `/common-grants/opportunities/${encodeURIComponent(id)}`),
    { headers: buildHeaders(src) },
  );
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${src.label} returned ${res.status} for get(${id})`);

  const body: unknown = await res.json();
  return body && typeof body === 'object' && 'data' in body
    ? (body as { data: unknown }).data
    : body;
}
