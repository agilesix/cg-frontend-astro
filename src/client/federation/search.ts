import type { SourceId } from './source';
import type { ActiveFilters } from '@/client/types';

// Browser-side search wrapper. All federation logic (per-source URL
// composition, auth header injection, filter pushdown vs in-memory split,
// merge/aggregate) lives in `src/server/upstream.ts` and runs server-side.

export interface SearchResult {
  items: unknown[];
  total: number;
  dataAsOf: string | null;
}

export async function searchSource(
  sourceId: SourceId,
  req: { query?: string; filters?: ActiveFilters },
): Promise<SearchResult> {
  const res = await fetch(`/api/sources/${sourceId}/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    throw new Error(`/api/sources/${sourceId}/search returned ${res.status}`);
  }
  return (await res.json()) as SearchResult;
}
