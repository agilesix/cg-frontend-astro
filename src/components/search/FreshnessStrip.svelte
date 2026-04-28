<script lang="ts">
  import { activeTab } from '@/stores/searchStore';
  import { activeState, clearCacheAndRefetch, loading } from '@/stores/resultsStore';
  import type { SourceId } from '@/client/federation/source';
  import { formatRelativeAge } from '@/lib/format';

  interface Props {
    available: Array<{ id: SourceId; label: string }>;
  }
  let { available }: Props = $props();

  // Looks up the active tab's label for the freshness line. Falls back to
  // the source ID if the descriptor list doesn't include it (shouldn't
  // happen — the search page only renders this when the active tab is
  // configured).
  function activeLabel(id: SourceId): string {
    return available.find((s) => s.id === id)?.label ?? id;
  }
</script>

<div class="freshness-strip" aria-live="polite">
  <span class="freshness-item">
    {activeLabel($activeTab)}:
    {#if $activeState.error}
      <span class="err">unavailable</span>
    {:else if $activeState.dataAsOf}
      {formatRelativeAge($activeState.dataAsOf)}
    {:else}
      —
    {/if}
  </span>
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
