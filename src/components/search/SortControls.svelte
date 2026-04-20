<script lang="ts">
  import { sortBy, sortOrder } from '@/stores/searchStore';
  import { total } from '@/stores/resultsStore';

  interface SortOption {
    value: string; // "field:order" composite
    label: string;
  }

  const SORT_OPTIONS: SortOption[] = [
    { value: 'keyDates.closeDate:asc', label: 'Close date (soonest)' },
    { value: 'keyDates.closeDate:desc', label: 'Close date (furthest)' },
    { value: 'createdAt:desc', label: 'Posted (newest)' },
    { value: 'title:asc', label: 'Title (A–Z)' },
    { value: 'funding.maxAwardAmount:asc', label: 'Maximum award (lowest)' },
    { value: 'funding.maxAwardAmount:desc', label: 'Maximum award (highest)' },
  ];

  function handleChange(e: Event) {
    const raw = (e.currentTarget as HTMLSelectElement).value;
    const [field, order] = raw.split(':');
    if (field) sortBy.set(field);
    if (order === 'asc' || order === 'desc') sortOrder.set(order);
  }
</script>

<div class="sort-controls">
  <p class="result-count">
    {$total}
    {$total === 1 ? 'opportunity' : 'opportunities'}
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
