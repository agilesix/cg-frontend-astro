import { fetchTabs } from '@/stores/resultsStore';
import type { SourceId } from '@/client/federation/source';

/** Coalesce synchronous store updates into one request batch for UI and tools. */
export function createSearchRefresh(sources: SourceId[]) {
  let queued: Promise<void> | undefined;
  let disposed = false;
  return {
    refresh() {
      if (disposed) return Promise.resolve();
      if (!queued)
        queued = Promise.resolve().then(() => {
          queued = undefined;
          if (!disposed) return fetchTabs(sources);
        });
      return queued;
    },
    dispose() {
      disposed = true;
    },
  };
}
