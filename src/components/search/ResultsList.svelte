<script lang="ts">
  import { visibleItems, loading, bySource, cacheHit, fetchResults } from '@/stores/resultsStore';
  import { clearAllFilters } from '@/stores/searchStore';
  import { createBrowserSources } from '@/client';
  import OpportunityCard from './OpportunityCard.svelte';
  import Alert from '@/components/uswds/Alert.svelte';
  import LoadingSpinner from '@/components/uswds/LoadingSpinner.svelte';

  // Built client-side (see UrlSync for the same pattern + reasoning).
  const sources = createBrowserSources();

  const sourcesWithErrors = $derived(
    Object.entries($bySource).filter(([, info]) => info.error) as Array<[string, { error: Error }]>,
  );
</script>

{#if $cacheHit}
  <p class="cache-indicator" aria-live="polite">Showing cached results</p>
{/if}

{#each sourcesWithErrors as [sourceId, info] (sourceId)}
  <Alert type="warning" heading="{sourceId === 'pa' ? 'Pennsylvania' : 'Federal'} unavailable">
    {info.error.message}
  </Alert>
{/each}

{#if $loading && $visibleItems.length === 0}
  <div class="skeleton-list">
    {#each Array(5) as _, i (i)}
      <div class="skeleton-card">
        <div class="shimmer-line shimmer-line--sm"></div>
        <div class="shimmer-line shimmer-line--lg"></div>
        <div class="shimmer-line"></div>
      </div>
    {/each}
    <LoadingSpinner />
  </div>
{:else if $visibleItems.length === 0}
  <div class="empty-state">
    <p><strong>No opportunities match your search.</strong></p>
    <p>Try adjusting your filters or search terms.</p>
    <button type="button" class="usa-button" onclick={clearAllFilters}>Clear filters</button>
    <button
      type="button"
      class="usa-button usa-button--outline"
      onclick={() => fetchResults(sources)}
    >
      Retry
    </button>
  </div>
{:else}
  <ul class="results-list" aria-label="Opportunities">
    {#each $visibleItems as item, i (i)}
      <li><OpportunityCard opportunity={item} /></li>
    {/each}
  </ul>
{/if}

<style>
  .cache-indicator {
    color: #565c65;
    font-size: 0.875rem;
    margin: 0 0 0.5rem;
  }
  .results-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .skeleton-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  .skeleton-card {
    border: 1px solid #dfe1e2;
    padding: 1rem;
    background: #fff;
  }
  .shimmer-line {
    height: 0.75rem;
    background: linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%);
    background-size: 200% 100%;
    animation: shimmer 1.2s infinite linear;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }
  .shimmer-line--sm {
    width: 30%;
  }
  .shimmer-line--lg {
    width: 70%;
    height: 1rem;
  }
  @keyframes shimmer {
    from {
      background-position: 200% 0;
    }
    to {
      background-position: -200% 0;
    }
  }
  .empty-state {
    text-align: center;
    padding: 3rem 1rem;
  }
  .empty-state > * + * {
    margin-top: 0.5rem;
  }
</style>
