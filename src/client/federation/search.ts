import type { OppFilters, OppSorting } from '@common-grants/sdk/types';
import type { SourceId, Tagged } from './source';

// Browser-side search wrapper. Just hits our own `/api/search` endpoint —
// all the per-source URL composition, auth, and merge logic lives in
// `src/server/upstream.ts` and runs server-side.

export interface FederatedSearchRequest {
  search?: string;
  filters?: OppFilters;
  sorting?: OppSorting;
  enabledSources?: SourceId[];
  pageSize?: number;
}

export interface FederatedSearchResult {
  items: Array<Tagged<unknown>>;
  bySource: Record<SourceId, { total: number; dataAsOf: string | null; error?: string }>;
}

export async function searchAll(req: FederatedSearchRequest): Promise<FederatedSearchResult> {
  const res = await fetch('/api/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`/api/search returned ${res.status}`);
  return (await res.json()) as FederatedSearchResult;
}
