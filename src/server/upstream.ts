// Server-only: per-source search via the shared grant service, with
// filter logic centralized here. The browser sends `{query, filters}`
// verbatim; this module decides what flows into `.search()` vs what's
// applied in memory after.
//
// Adding a new source (e.g. NY) is a one-block change in
// `buildSourceRegistry`: construct a service and register it.

import { createClients, createGrantService, type GrantService } from '@common-grants/grant-service';
import type { SourceId } from '@/client/federation/source';
import {
  pickPushdownFilters,
  pickLocalFilters,
  applyLocalFilters,
  type FilterMap,
} from './filterPushdown';

export interface SourceEntry {
  id: SourceId;
  label: string;
  service: Pick<GrantService, 'searchCollection' | 'getOpportunity'>;
}

function service(id: SourceId, label: string, baseUrl: string, token?: string): GrantService {
  // Preserve website source IDs (and therefore existing detail/bookmark URLs).
  return createGrantService(
    createClients([
      {
        name: id,
        label,
        baseUrl,
        auth: token ? { type: 'apiKey', key: token } : { type: 'none' },
      },
    ]),
  );
}

function buildSourceRegistry(): Partial<Record<SourceId, SourceEntry>> {
  const out: Partial<Record<SourceId, SourceEntry>> = {};

  // URLs are public — read via `import.meta.env` so Vite inlines them at
  // build time. This also makes them available at runtime in the Workers
  // bundle without needing to set them as Worker vars. The token, by
  // contrast, is a secret and stays in `process.env` so it's resolved
  // from the Worker's secret bindings at runtime.
  const paUrl = import.meta.env.PUBLIC_PA_API_URL;
  if (paUrl) {
    out.pa = {
      id: 'pa',
      label: 'Pennsylvania',
      service: service('pa', 'Pennsylvania', paUrl),
    };
  }

  const fedUrl = import.meta.env.PUBLIC_FEDERAL_API_URL;
  if (fedUrl) {
    const token = process.env.FEDERAL_API_TOKEN;
    out.federal = {
      id: 'federal',
      label: 'Federal (Grants.gov)',
      service: service('federal', 'Federal (Grants.gov)', fedUrl, token),
    };
  }

  const caUrl = import.meta.env.PUBLIC_CA_API_URL;
  if (caUrl) {
    out.california = {
      id: 'california',
      label: 'California',
      service: service('california', 'California', caUrl),
    };
  }

  const waUrl = import.meta.env.PUBLIC_WA_API_URL;
  if (waUrl) {
    out.washington = {
      id: 'washington',
      label: 'Washington',
      service: service('washington', 'Washington', waUrl),
    };
  }

  return out;
}

// Built once per isolate; the registry never changes after startup.
const REGISTRY = buildSourceRegistry();

export function getSourceEntry(id: SourceId): SourceEntry | undefined {
  return REGISTRY[id];
}

export function getSourceDescriptors(): Array<{ id: SourceId; label: string }> {
  return Object.values(REGISTRY)
    .filter((e): e is SourceEntry => e !== undefined)
    .map(({ id, label }) => ({ id, label }));
}

export interface SourceSearchRequest {
  query?: string;
  filters?: FilterMap;
  /** Cap per-source fetch size; client paginates over the result. */
  pageSize?: number;
}

export interface SourceSearchResult {
  items: unknown[];
  total: number;
  dataAsOf: string | null;
}

/**
 * Single-source search. Pushes the supported filters into the SDK call,
 * applies the rest in memory.
 */
export async function searchSource(
  source: SourceEntry,
  req: SourceSearchRequest,
): Promise<SourceSearchResult> {
  const pushdown = pickPushdownFilters(req.filters);
  const local = pickLocalFilters(req.filters, source.id);

  // The service collects up to 1,000 items before local filters run.
  // Do not substitute its MCP-oriented search(), which returns one short page.
  const result = await source.service.searchCollection({
    source: source.id,
    query: req.query || undefined,
    statuses: pushdown.statuses,
    pageSize: req.pageSize ?? 100,
  });

  const filtered = applyLocalFilters(result.items, local);

  return {
    items: filtered,
    // `total` reflects the post-local-filter count so the UI's "N results"
    // matches what's visible. The upstream's `paginationInfo.totalItems`
    // is the pre-filter total; useful but a different number.
    total: filtered.length,
    // SDK's .search() doesn't surface the X-Data-As-Of header. Accepted
    // tradeoff for using the high-level method; can be revisited if the
    // SDK exposes the raw Response or returns headers.
    dataAsOf: null,
  };
}

/**
 * Single-opportunity fetch via the shared service. Returns null on 404 so
 * the detail page can redirect to /search.
 */
export async function getFromSource(source: SourceEntry, id: string): Promise<unknown | null> {
  const result = await source.service.getOpportunity({ source: source.id, id });
  if (result.status === 'success') return result.opportunity;
  if (/\b404\b/.test(result.error ?? '')) return null;
  throw new Error(result.error ?? 'Upstream retrieval failed');
}
