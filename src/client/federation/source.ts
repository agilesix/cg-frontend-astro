// Browser-side source primitives. The full source config (URLs, tokens, SDK
// Clients) lives only on the server in `src/server/upstream.ts`; the
// browser only sees IDs and a tag attached to each merged item.

export type SourceId = 'pa' | 'federal';

export type Tagged<T> = T & { _source: SourceId };
