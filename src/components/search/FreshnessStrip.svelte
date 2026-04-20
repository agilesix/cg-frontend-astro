<script lang="ts">
  import { bySource, clearCacheAndRefetch, loading } from '@/stores/resultsStore';
  import { createSources } from '@/client';
  import type { SourceId } from '@/client/federation/source';
  import { formatRelativeAge } from '@/lib/format';

  // Built client-side — a Source is not JSON-serializable so we can't take it
  // as a prop from an Astro SSR parent.
  const sources = createSources();
  const enabledSourceIds = sources.map((s) => s.id);

  function labelFor(id: SourceId): string {
    return id === 'pa' ? 'PA' : 'Federal';
  }
</script>

<div class="freshness-strip" aria-live="polite">
  {#each enabledSourceIds as id (id)}
    {@const info = $bySource[id]}
    <span class="freshness-item">
      {labelFor(id)}:
      {#if info.error}
        <span class="err">unavailable</span>
      {:else if info.dataAsOf}
        {formatRelativeAge(info.dataAsOf)}
      {:else}
        —
      {/if}
    </span>
  {/each}
  <button
    type="button"
    class="usa-button usa-button--unstyled refresh-btn"
    disabled={$loading}
    onclick={() => clearCacheAndRefetch(sources)}
    aria-label="Refresh"
  >
    ↻ Refresh
  </button>
</div>

<style>
  .freshness-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    font-size: 0.875rem;
    color: #565c65;
    padding: 0.5rem 0;
    border-bottom: 1px solid #dfe1e2;
    margin-bottom: 1rem;
  }
  .err {
    color: #b50909;
  }
  .refresh-btn {
    margin-left: auto;
  }
</style>
