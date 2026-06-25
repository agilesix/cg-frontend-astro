<script lang="ts">
  import { onMount } from 'svelte';
  import { urlParams, hydrateStoresFromUrl } from '@/stores/searchStore';
  import { fetchTabs } from '@/stores/resultsStore';
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
    void fetchTabs(sources);

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
      void fetchTabs(sources);
    });

    return () => {
      unsubUrl();
      unsubRefetchOnStateChange();
    };
  });
</script>
