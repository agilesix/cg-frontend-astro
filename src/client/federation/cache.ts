import type { SourceId } from './source';

// Cache for federated search results, keyed by `${sourceId}:${stableJSON(req)}`.
// Source-prefixed keys mean the cache itself doesn't know what a source
// is — adding NY just produces `ny:...` keys with no other code change.

export interface CacheEntry {
  items: unknown[];
  total: number;
  dataAsOf: string | null;
  cachedAt: number;
}

export type ChangeListener = (key: string, entry: CacheEntry | null) => void;

const TTL_MS = 30 * 60_000; // 30 min — long enough for cross-tab/cross-session reuse, short enough to feel honest given upstream sync cadences
const MAX_ENTRIES = 20;
const STORAGE_PREFIX = 'cg-cache:';

/**
 * Stable JSON: sort object keys so semantically identical request objects
 * produce identical cache keys regardless of enumeration order.
 */
export function stableStringify(value: unknown): string {
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

export function cacheKey(sourceId: SourceId, req: unknown): string {
  return `${sourceId}:${stableStringify(req)}`;
}

class Cache {
  /** Insertion order = LRU recency; JS Map preserves insertion order. */
  private mem = new Map<string, CacheEntry>();
  private listeners = new Set<ChangeListener>();
  private storageBound = false;

  constructor() {
    // Bind to cross-tab `storage` events so all tabs converge on the same
    // cache state. Writes/deletes from other tabs flow into our in-memory
    // map and notify subscribers; subscribers (e.g. resultsStore) decide
    // whether the change affects what they're currently rendering.
    if (typeof window !== 'undefined' && !this.storageBound) {
      window.addEventListener('storage', (e) => this.onStorageEvent(e));
      this.storageBound = true;
    }
  }

  get(key: string): CacheEntry | null {
    const hit = this.mem.get(key);
    if (hit) {
      if (this.expired(hit)) {
        this.mem.delete(key);
        this.removeFromStorage(key);
        return null;
      }
      // Refresh LRU position.
      this.mem.delete(key);
      this.mem.set(key, hit);
      return hit;
    }
    return this.hydrateFromStorage(key);
  }

  set(key: string, value: Omit<CacheEntry, 'cachedAt'>): void {
    this.evictIfFull();
    const entry: CacheEntry = { ...value, cachedAt: Date.now() };
    this.mem.set(key, entry);
    this.persistToStorage(key, entry);
    // Local writes don't notify — the caller put the data here and is
    // already updating UI state directly. `onChange` is for *external*
    // cache mutations (cross-tab `storage` events and `clear()`).
  }

  clear(): void {
    this.mem.clear();
    if (typeof localStorage !== 'undefined') {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(STORAGE_PREFIX)) localStorage.removeItem(k);
      }
    }
    // No local notify — the caller of `clear()` (typically the refresh
    // button) is responsible for refetching. Cross-tab listeners are
    // notified via the `storage` events that `removeItem` triggers in
    // *other* tabs.
  }

  /** Subscribe to cache changes. Returns an unsubscribe function. */
  onChange(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private expired(entry: CacheEntry): boolean {
    return Date.now() - entry.cachedAt > TTL_MS;
  }

  private evictIfFull(): void {
    if (this.mem.size < MAX_ENTRIES) return;
    const oldest = this.mem.keys().next().value;
    if (oldest === undefined) return;
    this.mem.delete(oldest);
    this.removeFromStorage(oldest);
  }

  private hydrateFromStorage(key: string): CacheEntry | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    try {
      const entry = JSON.parse(raw) as CacheEntry;
      if (this.expired(entry)) {
        localStorage.removeItem(STORAGE_PREFIX + key);
        return null;
      }
      this.mem.set(key, entry);
      return entry;
    } catch {
      return null;
    }
  }

  private persistToStorage(key: string, entry: CacheEntry): void {
    if (typeof localStorage === 'undefined') return;
    const fullKey = STORAGE_PREFIX + key;
    const serialized = JSON.stringify(entry);
    const write = () => localStorage.setItem(fullKey, serialized);
    try {
      write();
    } catch {
      // Likely QuotaExceededError. Drop the oldest persistent entry and
      // try once more. If it still fails, fall back silently — in-memory
      // cache still works for this session.
      this.pruneOldestPersistent();
      try {
        write();
      } catch {
        /* keep in-memory only */
      }
    }
  }

  private removeFromStorage(key: string): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(STORAGE_PREFIX + key);
  }

  /** Remove the oldest in-memory entry that also has a localStorage copy. */
  private pruneOldestPersistent(): void {
    if (typeof localStorage === 'undefined') return;
    for (const key of this.mem.keys()) {
      const fullKey = STORAGE_PREFIX + key;
      if (localStorage.getItem(fullKey) !== null) {
        localStorage.removeItem(fullKey);
        return;
      }
    }
  }

  private onStorageEvent(e: StorageEvent): void {
    if (!e.key || !e.key.startsWith(STORAGE_PREFIX)) return;
    const key = e.key.slice(STORAGE_PREFIX.length);
    if (e.newValue === null) {
      this.mem.delete(key);
      this.notify(key, null);
      return;
    }
    try {
      const entry = JSON.parse(e.newValue) as CacheEntry;
      this.mem.set(key, entry);
      this.notify(key, entry);
    } catch {
      // Corrupt entry from another tab — ignore.
    }
  }

  private notify(key: string, entry: CacheEntry | null): void {
    for (const fn of this.listeners) {
      try {
        fn(key, entry);
      } catch (err) {
        // A bad listener shouldn't break cache writes for everyone else.
        console.error('cache listener threw:', err);
      }
    }
  }
}

export const resultCache = new Cache();
