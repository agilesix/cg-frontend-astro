<script lang="ts">
  import { onMount } from 'svelte';
  import { urlParams, hydrateStoresFromUrl } from '@/stores/searchStore';
  import { fetchResults } from '@/stores/resultsStore';

  // No prop, no source list — `fetchResults` posts to `/api/search` which
  // reads server-side env and fans out. Browser has no idea about Sources.

  onMount(() => {
    hydrateStoresFromUrl(window.location.search);
    void fetchResults();

    // Keep the URL in sync with state. replaceState (not pushState) so we
    // don't inflate browser history with every filter toggle.
    const unsubUrl = urlParams.subscribe((serialized) => {
      const next = serialized
        ? `${window.location.pathname}?${serialized}`
        : window.location.pathname;
      if (next !== window.location.pathname + window.location.search) {
        window.history.replaceState({}, '', next);
      }
    });

    // Refetch on any cache-key-affecting change. The cache layer dedupes.
    const unsubRefetch = urlParams.subscribe(() => {
      void fetchResults();
    });

    return () => {
      unsubUrl();
      unsubRefetch();
    };
  });
</script>
