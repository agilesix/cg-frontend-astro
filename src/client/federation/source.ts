// Browser-side source primitives. The full source config (URLs, tokens, SDK
// Clients) lives only on the server in `src/server/upstream.ts`; the
// browser only sees IDs and a tag attached to each merged item.

export type SourceId = 'pa' | 'federal' | 'california';

export type Tagged<T> = T & { _source: SourceId };

/** Short, user-facing label for each source. Used by tags, cards, and alerts. */
export const SOURCE_LABELS: Record<SourceId, string> = {
  pa: 'Pennsylvania',
  federal: 'Federal',
  california: 'California',
};
