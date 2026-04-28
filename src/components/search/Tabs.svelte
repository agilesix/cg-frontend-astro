<script lang="ts">
  import { activeTab } from '@/stores/searchStore';
  import { sourceState } from '@/stores/resultsStore';
  import type { SourceId } from '@/client/federation/source';

  interface Props {
    available: Array<{ id: SourceId; label: string }>;
  }
  let { available }: Props = $props();

  function select(id: SourceId): void {
    if (id !== $activeTab) activeTab.set(id);
  }

  function countLabel(id: SourceId): string {
    const total = $sourceState[id]?.total ?? 0;
    return ` · ${total}`;
  }
</script>

{#if available.length > 1}
  <nav class="tabs" aria-label="Source">
    <ul class="tabs__list">
      {#each available as src (src.id)}
        <li class="tabs__item">
          <button
            type="button"
            class="tabs__button"
            class:tabs__button--active={$activeTab === src.id}
            aria-current={$activeTab === src.id ? 'page' : undefined}
            onclick={() => select(src.id)}
          >
            {src.label}<span class="tabs__count">{countLabel(src.id)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </nav>
{/if}

<style>
  .tabs {
    border-bottom: 2px solid #dfe1e2;
    margin-bottom: 1rem;
  }
  .tabs__list {
    display: flex;
    gap: 0.25rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .tabs__button {
    background: transparent;
    border: 0;
    border-bottom: 3px solid transparent;
    color: #565c65;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 500;
    margin-bottom: -2px;
    padding: 0.5rem 1rem;
  }
  .tabs__button:hover {
    color: #005ea2;
  }
  .tabs__button--active {
    color: #005ea2;
    border-bottom-color: #005ea2;
  }
  .tabs__count {
    color: #565c65;
    font-weight: 400;
  }
  .tabs__button--active .tabs__count {
    color: #005ea2;
  }
</style>
