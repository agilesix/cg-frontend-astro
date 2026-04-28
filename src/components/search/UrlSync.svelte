<script lang="ts">
  import { onMount } from 'svelte';
  import { urlParams, hydrateStoresFromUrl } from '@/stores/searchStore';
  import { fetchResults } from '@/stores/resultsStore';
  import { createBrowserSources } from '@/client';

  // Sources are built client-side rather than passed in as a prop because a
  // Source contains a live SDK Client (not JSON-serializable) — Astro would
  // silently strip the prop on island hydration.
  const sources = createBrowserSources();

  onMount(() => {
    hydrateStoresFromUrl(window.location.search);
    void fetchResults(sources);

    // Keep the URL in sync with state; replaceState (not pushState) so we
    // don't inflate history with every filter toggle.
    const unsubUrl = urlParams.subscribe((serialized) => {
      const next = serialized
        ? `${window.location.pathname}?${serialized}`
        : window.location.pathname;
      if (next !== window.location.pathname + window.location.search) {
        window.history.replaceState({}, '', next);
      }
    });

    // Refetch on any cache-key-affecting change. Cache layer dedupes where possible.
    const unsubRefetch = urlParams.subscribe(() => {
      void fetchResults(sources);
    });

    return () => {
      unsubUrl();
      unsubRefetch();
    };
  });
</script>
