/** Small helpers for rendering Opportunity fields consistently. */

/**
 * Coerce a date-like value into epoch milliseconds. Handles ISO strings,
 * `Date` instances (the SDK parses dates into `Date`), and CommonGrants date
 * events — a discriminated union on `eventType`:
 *   - `singleDate`  → `date`
 *   - `dateRange`   → `endDate` (the effective deadline) falling back to `startDate`
 *   - `other`       → no comparable date
 * Returns null when no usable date is present.
 */
export function dateToTimestamp(raw: unknown): number | null {
  if (raw == null) return null;
  if (raw instanceof Date) {
    const t = raw.getTime();
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : null;
  }
  if (typeof raw === 'object') {
    const ev = raw as Record<string, unknown>;
    const candidate =
      ev.eventType === 'dateRange'
        ? (ev.endDate ?? ev.startDate)
        : (ev.date ?? ev.startDate ?? ev.endDate);
    if (candidate != null && candidate !== raw) return dateToTimestamp(candidate);
  }
  return null;
}

function isCivilDate(raw: unknown): boolean {
  if (typeof raw === 'string') return /^\d{4}-\d{2}-\d{2}$/.test(raw);
  if (raw == null || typeof raw !== 'object' || raw instanceof Date) return false;
  const eventType = (raw as Record<string, unknown>).eventType;
  return eventType === 'singleDate' || eventType === 'dateRange';
}

export function formatDate(raw: unknown): string | null {
  const t = dateToTimestamp(raw);
  if (t == null) return null;
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    // A protocol date without a time is a civil date, not a UTC instant.
    ...(isCivilDate(raw) ? { timeZone: 'UTC' } : {}),
  });
}

export function formatCurrency(raw: unknown): string | null {
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatFundingRange(min: unknown, max: unknown): string {
  const lo = formatCurrency(min);
  const hi = formatCurrency(max);
  if (lo && hi) return `${lo}–${hi}`;
  if (hi) return `Up to ${hi}`;
  if (lo) return `From ${lo}`;
  return 'Amount not specified';
}

export function formatRelativeAge(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (!Number.isFinite(t)) return null;
  const diffMs = Date.now() - t;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(t).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

/** Return a usable HTTP(S) URL, or null for malformed and non-web values. */
export function asHttpUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  try {
    const url = new URL(raw);
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const hasValidHostname = url.hostname
      .split('.')
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label));
    return isHttp && hasValidHostname ? raw : null;
  } catch {
    return null;
  }
}
