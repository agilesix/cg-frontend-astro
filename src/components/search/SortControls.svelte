<script lang="ts">
  import { sortBy, sortOrder } from '@/stores/searchStore';
  import { total, loading, error } from '@/stores/resultsStore';
  import { SORT_OPTIONS } from '@/client/searchOptions';

  function handleChange(e: Event) {
    const raw = (e.currentTarget as HTMLSelectElement).value;
    const [field, order] = raw.split(':');
    if (field) sortBy.set(field);
    if (order === 'asc' || order === 'desc') sortOrder.set(order);
  }
</script>

<div class="sort-controls">
  <p class="result-count">
    {#if $loading}Loading…{:else if $error}Results unavailable{:else}
      {$total} {$total === 1 ? 'opportunity' : 'opportunities'}
    {/if}
  </p>
  <div class="sort-picker">
    <label class="usa-label" for="sort-select">Sort by</label>
    <select
      id="sort-select"
      class="usa-select"
      value="{$sortBy}:{$sortOrder}"
      onchange={handleChange}
    >
      {#each SORT_OPTIONS as opt (opt.value)}
        <option value={opt.value}>{opt.label}</option>
      {/each}
    </select>
  </div>
</div>

<style>
  .sort-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .result-count {
    margin: 0;
    font-weight: 600;
  }
  .sort-picker {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .sort-picker .usa-label {
    margin: 0;
  }
  .sort-picker .usa-select {
    width: auto;
    min-width: 14rem;
  }
</style>
