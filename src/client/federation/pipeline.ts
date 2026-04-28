import type { SortOrder } from '@/client/types';

// In-memory sort + paginate. Filter has moved server-side; this file is
// just the small client-side pipeline that runs over the cached response.

function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') {
    const ta = Date.parse(a);
    const tb = Date.parse(b);
    if (Number.isFinite(ta) && Number.isFinite(tb)) return ta - tb;
    return a.localeCompare(b);
  }
  return String(a).localeCompare(String(b));
}

/**
 * Stable, path-aware sort. `sortBy` is a dot-notation path. Nulls/undefined
 * are always emitted last regardless of sort order.
 */
export function sortMerged<T>(items: T[], sortBy: string, sortOrder: SortOrder): T[] {
  const mult = sortOrder === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const va = getByPath(a, sortBy);
    const vb = getByPath(b, sortBy);
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    return mult * compareValues(va, vb);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(totalItems: number, pageSize: number): number {
  return Math.max(1, Math.ceil(totalItems / pageSize));
}
