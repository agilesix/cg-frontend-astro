// Server-only: per-source search via the SDK's high-level methods, with
// filter logic centralized here. The browser sends `{query, filters}`
// verbatim; this module decides what flows into `.search()` vs what's
// applied in memory after.
//
// Adding a new source (e.g. NY) is a one-block change in
// `buildSourceRegistry`: construct a `Client` and register it.

import { Client, Auth } from '@common-grants/sdk/client';
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
  client: Client;
}

function buildSourceRegistry(): Partial<Record<SourceId, SourceEntry>> {
  const out: Partial<Record<SourceId, SourceEntry>> = {};

  const paUrl = process.env.PA_API_URL ?? process.env.PUBLIC_PA_API_URL;
  if (paUrl) {
    out.pa = {
      id: 'pa',
      label: 'Pennsylvania',
      client: new Client({ baseUrl: paUrl, auth: Auth.none() }),
    };
  }

  const fedUrl = process.env.FEDERAL_API_URL ?? process.env.PUBLIC_FEDERAL_API_URL;
  if (fedUrl) {
    const token = process.env.FEDERAL_API_TOKEN;
    out.federal = {
      id: 'federal',
      label: 'Federal (Grants.gov)',
      client: new Client({
        baseUrl: fedUrl,
        auth: token ? Auth.apiKey(token) : Auth.none(),
      }),
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

  const result = await source.client.opportunities.search({
    query: req.query || undefined,
    statuses: pushdown.statuses,
    page: 1,
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
 * Single-opportunity fetch via the SDK's `.get()`. Returns null on 404 so
 * the detail page can redirect to /search.
 */
export async function getFromSource(source: SourceEntry, id: string): Promise<unknown | null> {
  try {
    return await source.client.opportunities.get(id);
  } catch (err) {
    // SDK throws a generic Error with the status in the message; sniff for 404.
    if (err instanceof Error && /\b404\b/.test(err.message)) return null;
    throw err;
  }
}
