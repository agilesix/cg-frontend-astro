<script lang="ts">
  import { onMount } from 'svelte';
  import { urlParams, hydrateStoresFromUrl, activeTab } from '@/stores/searchStore';
  import { fetchActiveTab } from '@/stores/resultsStore';

  // No prop, no source list. `fetchActiveTab` posts to
  // `/api/sources/[active]/search`; the server reads env and runs the
  // upstream call. Browser knows nothing about source URLs or tokens.

  onMount(() => {
    hydrateStoresFromUrl(window.location.search);
    void fetchActiveTab();

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

    // Refetch on any URL-relevant state change (active tab, query, filters).
    // Cache layer dedupes — switching back to a recent state is instant.
    const unsubRefetchOnStateChange = urlParams.subscribe(() => {
      void fetchActiveTab();
    });

    // Also explicitly refetch when the active tab changes — `urlParams`
    // fires for that too, but this makes the dependency obvious.
    const unsubTab = activeTab.listen(() => {
      void fetchActiveTab();
    });

    return () => {
      unsubUrl();
      unsubRefetchOnStateChange();
      unsubTab();
    };
  });
</script>
