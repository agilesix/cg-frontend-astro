// Server-only: the single seam between "what the SDK forwards to the API"
// and "what we apply in memory after the API responds."
//
// Today the SDK's `client.opportunities.search()` only accepts `query` and
// `statuses`, so `status` is the only filter we push down. Every other
// filter is applied locally in `applyLocalFilters`. When the SDK exposes
// more filter params (e.g. `closeDateRange`), move that filter from
// `applyLocalFilters` to `pickPushdownFilters` — that's the only file
// that needs to change.

import type { OppStatusOptions } from '@common-grants/sdk/types';
import type { SourceId } from '@/client/federation/source';
import type { FilterConfig } from '@/types/portal';
import { portalConfig } from '@/portal.config';

// Mirror of `ActiveFilters` (same shape; importing across the
// browser/server boundary would just be ceremony).
interface DateRange {
  start?: string;
  end?: string;
}
interface NumberRange {
  min?: number;
  max?: number;
}
type FilterValue = string | string[] | DateRange | NumberRange | undefined;
export type FilterMap = Record<string, FilterValue>;

export interface PushdownFilters {
  query?: string;
  statuses?: OppStatusOptions[];
}

// =============================================================================
// Pushdown — what we forward to `client.opportunities.search()`
// =============================================================================

/** Today: only `status` pushes down. Tomorrow: more rows when the SDK exposes them. */
export function pickPushdownFilters(filters: FilterMap | undefined): PushdownFilters {
  if (!filters) return {};
  const out: PushdownFilters = {};
  const status = filters.status;
  if (Array.isArray(status) && status.length > 0) {
    out.statuses = status as OppStatusOptions[];
  }
  return out;
}

// =============================================================================
// Local — applied in memory after the API call
// =============================================================================

function isDateRange(v: unknown): v is DateRange {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && ('start' in v || 'end' in v);
}

function isNumberRange(v: unknown): v is NumberRange {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && ('min' in v || 'max' in v);
}

function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function matches(actual: unknown, selected: FilterValue, type: FilterConfig['type']): boolean {
  if (type === 'checkbox-group' || type === 'select') {
    if (!Array.isArray(selected)) return false;
    if (actual == null) return false;
    return selected.includes(actual as string);
  }
  if (type === 'date-range') {
    if (!isDateRange(selected)) return false;
    if (typeof actual !== 'string') return false;
    const t = Date.parse(actual);
    if (!Number.isFinite(t)) return false;
    if (selected.start && t < Date.parse(selected.start)) return false;
    if (selected.end && t > Date.parse(selected.end)) return false;
    return true;
  }
  if (type === 'number-range') {
    if (!isNumberRange(selected)) return false;
    const n = typeof actual === 'number' ? actual : Number(actual);
    if (!Number.isFinite(n)) return false;
    if (selected.min != null && n < selected.min) return false;
    if (selected.max != null && n > selected.max) return false;
    return true;
  }
  return false;
}

/**
 * Filters that need in-memory application for a given source. Excludes
 * filters that pushed down (handled by the API), filters with no value set,
 * and filters that don't apply to this source (no `perSource[source]` entry).
 */
export function pickLocalFilters(
  filters: FilterMap | undefined,
  source: SourceId,
): Array<{ cfg: FilterConfig; value: FilterValue; fieldPath: string }> {
  if (!filters) return [];
  const out: Array<{ cfg: FilterConfig; value: FilterValue; fieldPath: string }> = [];
  for (const cfg of portalConfig.filters) {
    // Status pushes down; skip locally.
    if (cfg.id === 'status') continue;

    const value = filters[cfg.id];
    if (value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;

    // Universal filters (no perSource map) without a special pushdown branch
    // would fall through to here — none today, but the hook is in place.
    const mapping = cfg.perSource?.[source];
    if (!mapping) continue;

    out.push({ cfg, value, fieldPath: mapping.fieldPath });
  }
  return out;
}

/**
 * Run every applicable local filter over the API response. Items missing
 * the relevant field path are excluded (consistent with: "user asked for
 * X; if we can't tell whether the item has X, don't show it").
 */
export function applyLocalFilters(
  items: unknown[],
  local: ReturnType<typeof pickLocalFilters>,
): unknown[] {
  if (local.length === 0) return items;
  return items.filter((item) => {
    for (const { cfg, value, fieldPath } of local) {
      const actual = getByPath(item, fieldPath);
      if (!matches(actual, value, cfg.type)) return false;
    }
    return true;
  });
}
