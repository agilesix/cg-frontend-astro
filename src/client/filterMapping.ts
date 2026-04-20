import type { OppFilters } from '@common-grants/sdk/types';
import type { ActiveFilters, DateRangeValue, NumberRangeValue } from './types';
import type { Tagged } from './federation/source';
import type { FilterConfig } from '@/types/portal';

const USD = 'USD';

function isDateRange(v: unknown): v is DateRangeValue {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && ('start' in v || 'end' in v);
}

function isNumberRange(v: unknown): v is NumberRangeValue {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && ('min' in v || 'max' in v);
}

/**
 * Translate the UI's flat ActiveFilters into the subset the API understands.
 * Only filters declared `mode: 'server'` in the config go here; everything
 * else is applied client-side via {@link applyClientFilters}.
 */
export function toOppFilters(active: ActiveFilters, cfg: readonly FilterConfig[]): OppFilters {
  const out: OppFilters = {};
  for (const f of cfg) {
    if (f.mode !== 'server') continue;
    const value = active[f.id];
    if (value == null || (Array.isArray(value) && value.length === 0)) continue;

    // Canonical filter IDs map to specific OppFilters keys.
    if (f.id === 'status' && Array.isArray(value)) {
      out.status = { operator: 'in', value };
    } else if (f.id === 'closeDate' && isDateRange(value) && (value.start || value.end)) {
      // The API's range is `between {min, max}`. We require both bounds; if the
      // user only set one, we default the other to a far-out sentinel so the
      // half-open range is expressible. Pragmatic for the MVP.
      out.closeDateRange = {
        operator: 'between',
        value: { min: value.start ?? '1970-01-01', max: value.end ?? '2999-12-31' },
      };
    } else if (
      f.id === 'funding' &&
      isNumberRange(value) &&
      (value.min != null || value.max != null)
    ) {
      out.maxAwardAmountRange = {
        operator: 'between',
        value: {
          min: { amount: String(value.min ?? 0), currency: USD },
          max: { amount: String(value.max ?? Number.MAX_SAFE_INTEGER), currency: USD },
        },
      };
    }
    // Unknown server-side filter IDs are skipped. This lets portal.config.ts
    // declare server filters we haven't wired yet without breaking builds.
  }
  return out;
}

/**
 * Walk a dot-notation path into an object. Returns undefined for any missing segment.
 * Handles nullish safely — a null at any step short-circuits.
 */
function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function matchesFilter(actual: unknown, selected: unknown, type: FilterConfig['type']): boolean {
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
 * Apply every `mode: 'client'` filter to the merged item list. Items from a
 * source that isn't targeted by a `sourceFilter`-scoped filter pass through
 * unchanged for that filter.
 */
export function applyClientFilters<T>(
  items: Array<Tagged<T>>,
  active: ActiveFilters,
  cfg: readonly FilterConfig[],
): Array<Tagged<T>> {
  const clientFilters = cfg.filter((f) => f.mode === 'client');
  if (clientFilters.length === 0) return items;
  return items.filter((item) => {
    for (const f of clientFilters) {
      if (f.sourceFilter && item._source !== f.sourceFilter) continue;
      const selected = active[f.id];
      if (selected == null) continue;
      if (Array.isArray(selected) && selected.length === 0) continue;
      if (!f.fieldPath) continue;
      const actual = getByPath(item, f.fieldPath);
      if (!matchesFilter(actual, selected, f.type)) return false;
    }
    return true;
  });
}
