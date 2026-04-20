import type { OppFilters } from '@common-grants/sdk/types';
import type { SourceId, Tagged } from './source';

export interface CachedSearch {
  items: Array<Tagged<unknown>>;
  bySource: Record<SourceId, { total: number; dataAsOf: string | null; error?: Error }>;
}

interface CacheEntry extends CachedSearch {
  key: string;
  cachedAt: number;
}

const TTL_MS = 5 * 60_000;
const MAX_ENTRIES = 20;
const STORAGE_PREFIX = 'cg-cache:';

/**
 * Stable JSON: sort object keys so semantically identical filter objects
 * produce identical cache keys regardless of enumeration order.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k]))
      .join(',') +
    '}'
  );
}

export function cacheKey(opts: {
  search: string;
  enabledSources: SourceId[];
  serverFilters: OppFilters;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}): string {
  return stableStringify({
    s: opts.search,
    src: [...opts.enabledSources].sort(),
    f: opts.serverFilters,
    sb: opts.sortBy,
    so: opts.sortOrder,
  });
}

class ResultCache {
  // Insertion order = LRU recency; JS Map preserves insertion order.
  private mem = new Map<string, CacheEntry>();

  get(key: string): CachedSearch | null {
    const hit = this.mem.get(key);
    if (hit) {
      if (Date.now() - hit.cachedAt > TTL_MS) {
        this.mem.delete(key);
        return null;
      }
      // Refresh LRU position.
      this.mem.delete(key);
      this.mem.set(key, hit);
      return { items: hit.items, bySource: hit.bySource };
    }
    return this.hydrateFromStorage(key);
  }

  set(key: string, value: CachedSearch): void {
    if (this.mem.size >= MAX_ENTRIES) {
      const oldest = this.mem.keys().next().value;
      if (oldest !== undefined) {
        this.mem.delete(oldest);
        // Evict from storage in lock-step; otherwise the LRU cap is silently
        // defeated by the sessionStorage fallback.
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem(STORAGE_PREFIX + oldest);
        }
      }
    }
    const entry: CacheEntry = { ...value, key, cachedAt: Date.now() };
    this.mem.set(key, entry);
    this.persistToStorage(entry);
  }

  clear(): void {
    this.mem.clear();
    if (typeof sessionStorage === 'undefined') return;
    const toRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
    }
    for (const k of toRemove) sessionStorage.removeItem(k);
  }

  private hydrateFromStorage(key: string): CachedSearch | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry;
      if (Date.now() - entry.cachedAt > TTL_MS) {
        sessionStorage.removeItem(STORAGE_PREFIX + key);
        return null;
      }
      this.mem.set(key, entry);
      return { items: entry.items, bySource: entry.bySource };
    } catch {
      return null;
    }
  }

  private persistToStorage(entry: CacheEntry): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.setItem(STORAGE_PREFIX + entry.key, JSON.stringify(entry));
    } catch {
      // Quota exceeded or similar — in-memory cache still works.
    }
  }
}

export const resultCache = new ResultCache();
