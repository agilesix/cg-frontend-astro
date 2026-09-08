<script lang="ts">
  import { onMount } from 'svelte';
  import { urlParams, hydrateStoresFromUrl, activeTab } from '@/stores/searchStore';
  import { createSearchRefresh } from '@/client/searchRefresh';
  import { modelContext, registerTools } from '@/client/webmcp/register';
  import { SOURCE_LABELS } from '@/client/federation/source';
  import type { SourceId } from '@/client/federation/source';

  // `sources` is the list of configured source IDs (from the server). We fetch
  // ALL of them on every criteria change so every tab's count reflects the
  // current query/filters — not just the active tab's. The browser still knows
  // nothing about source URLs or tokens; it only posts to /api/sources/[id]/search.
  interface Props {
    sources: SourceId[];
  }
  let { sources }: Props = $props();

  onMount(() => {
    hydrateStoresFromUrl(window.location.search);
    const refresh = createSearchRefresh(sources);
    if (!sources.includes(activeTab.get()) && sources[0]) activeTab.set(sources[0]);

    // Keep the URL synced. replaceState (not pushState) so we don't inflate
    // browser history with every filter toggle.
    const unsubUrl = urlParams.subscribe((serialized) => {
      const next = serialized
        ? `${window.location.pathname}?${serialized}`
        : window.location.pathname;
      if (next !== window.location.pathname + window.location.search) {
        window.history.replaceState({}, '', next);
      }
    });

    // Refetch every source on any URL-relevant state change (tab, query,
    // filters, sort). The cache dedupes, so unchanged sources are instant.
    const unsubRefetchOnStateChange = urlParams.subscribe(() => {
      void refresh.refresh();
    });

    let disposed = false;
    let unregister = () => {};
    const context = modelContext();
    if (context && sources.length) {
      void import('@/client/webmcp/tools')
        .then(async ({ createSiteTools }) => {
          if (disposed) return;
          const cleanup = await registerTools(
            context,
            createSiteTools(
              sources.map((id) => ({ id, label: SOURCE_LABELS[id] })),
              refresh.refresh,
            ),
          );
          if (disposed) cleanup();
          else unregister = cleanup;
        })
        .catch(() => console.warn('Site tools unavailable; normal search remains available.'));
    }

    return () => {
      unsubUrl();
      unsubRefetchOnStateChange();
      disposed = true;
      unregister();
      refresh.dispose();
    };
  });
</script>
