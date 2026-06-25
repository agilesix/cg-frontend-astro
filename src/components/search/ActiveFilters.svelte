<script lang="ts">
  import { filters, query, clearAllFilters } from '@/stores/searchStore';
  import { portalConfig } from '@/portal.config';
  import type { ActiveFilters, DateRangeValue, NumberRangeValue } from '@/client/types';
  import Tag from '@/components/uswds/Tag.svelte';

  interface Chip {
    id: string;
    label: string;
    remove: () => void;
  }

  const chips = $derived.by<Chip[]>(() => {
    const out: Chip[] = [];
    if ($query) {
      out.push({
        id: '__q',
        label: `Search: "${$query}"`,
        remove: () => query.set(''),
      });
    }
    for (const cfg of portalConfig.filters) {
      const v = $filters[cfg.id];
      if (v == null) continue;
      if (Array.isArray(v)) {
        for (const item of v) {
          out.push({
            id: `${cfg.id}:${item}`,
            label: `${cfg.label}: ${item}`,
            remove: () => removeArrayItem(cfg.id, item),
          });
        }
      } else if (typeof v === 'object') {
        const r = v as Partial<DateRangeValue & NumberRangeValue>;
        const label = describeRange(cfg.label, r);
        if (label) {
          out.push({
            id: cfg.id,
            label,
            remove: () => removeKey(cfg.id),
          });
        }
      }
    }
    return out;
  });

  function removeArrayItem(id: string, item: string) {
    const current = $filters[id];
    if (!Array.isArray(current)) return;
    const next = current.filter((x) => x !== item);
    const map: ActiveFilters = { ...$filters };
    if (next.length === 0) delete map[id];
    else map[id] = next;
    filters.set(map);
  }

  function removeKey(id: string) {
    const next = { ...$filters };
    delete next[id];
    filters.set(next);
  }

  function describeRange(
    label: string,
    r: Partial<DateRangeValue & NumberRangeValue>,
  ): string | null {
    if (r.start || r.end) return `${label}: ${r.start ?? '…'} – ${r.end ?? '…'}`;
    if (r.min != null || r.max != null) return `${label}: ${r.min ?? '…'} – ${r.max ?? '…'}`;
    return null;
  }

  function clearAll() {
    clearAllFilters();
  }
</script>

{#if chips.length > 0}
  <div class="active-filters" aria-label="Active filters">
    {#each chips as chip (chip.id)}
      <Tag label={chip.label} onRemove={chip.remove} />
    {/each}
    <button type="button" class="usa-button usa-button--unstyled" onclick={clearAll}>
      Clear all
    </button>
  </div>
{/if}

<style>
  .active-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1rem;
  }
</style>
