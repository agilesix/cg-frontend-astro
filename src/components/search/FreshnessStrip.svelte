<script lang="ts">
  import { bySource, clearCacheAndRefetch, loading } from '@/stores/resultsStore';
  import type { SourceId } from '@/client/federation/source';
  import { formatRelativeAge } from '@/lib/format';

  interface Props {
    available: Array<{ id: SourceId; label: string }>;
  }
  let { available }: Props = $props();

  function labelFor(id: SourceId): string {
    return id === 'pa' ? 'PA' : 'Federal';
  }
</script>

<div class="freshness-strip" aria-live="polite">
  {#each available as src (src.id)}
    {@const info = $bySource[src.id]}
    <span class="freshness-item">
      {labelFor(src.id)}:
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
    onclick={() => clearCacheAndRefetch()}
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
