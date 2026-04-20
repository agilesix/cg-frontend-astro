<script lang="ts">
  import { filters, clearAllFilters } from '@/stores/searchStore';
  import { rawItems } from '@/stores/resultsStore';
  import { portalConfig } from '@/portal.config';
  import type { ActiveFilters, DateRangeValue, NumberRangeValue } from '@/client/types';
  import type { FilterConfig } from '@/types/portal';
  import Accordion from '@/components/uswds/Accordion.svelte';
  import Checkbox from '@/components/uswds/Checkbox.svelte';
  import DateRangePicker from '@/components/uswds/DateRangePicker.svelte';

  function updateFilter(id: string, value: ActiveFilters[string]) {
    const next = { ...$filters };
    if (value == null || (Array.isArray(value) && value.length === 0)) {
      delete next[id];
    } else {
      next[id] = value;
    }
    filters.set(next);
  }

  function toggleCheckbox(id: string, option: string, checked: boolean) {
    const current = $filters[id];
    const arr = Array.isArray(current) ? [...current] : [];
    const idx = arr.indexOf(option);
    if (checked && idx === -1) arr.push(option);
    else if (!checked && idx !== -1) arr.splice(idx, 1);
    updateFilter(id, arr);
  }

  function deriveOptions(cfg: FilterConfig): readonly string[] {
    if (cfg.options) return cfg.options;
    if (cfg.optionsSource !== 'derive' || !cfg.fieldPath) return [];
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const seen = new Set<string>();
    for (const item of $rawItems) {
      if (cfg.sourceFilter && item._source !== cfg.sourceFilter) continue;
      const val = getByPath(item, cfg.fieldPath);
      if (typeof val === 'string' && val) seen.add(val);
    }
    return [...seen].sort();
  }

  function getByPath(obj: unknown, path: string): unknown {
    let cur: unknown = obj;
    for (const seg of path.split('.')) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  }

  function isActive(cfg: FilterConfig): boolean {
    const v = $filters[cfg.id];
    if (v == null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'object') {
      const r = v as Partial<DateRangeValue & NumberRangeValue>;
      return Boolean(r.start || r.end || r.min != null || r.max != null);
    }
    return true;
  }
</script>

<aside class="filter-panel">
  <div class="filter-header">
    <h2 class="usa-h3">Filters</h2>
    <button type="button" class="usa-button usa-button--unstyled" onclick={clearAllFilters}>
      Clear all
    </button>
  </div>

  {#each portalConfig.filters as cfg (cfg.id)}
    <Accordion
      id="filter-{cfg.id}"
      heading={cfg.label}
      defaultOpen={cfg.defaultOpen ?? false}
      hasActiveIndicator
      isActive={isActive(cfg)}
    >
      {#if cfg.hint}
        <p class="usa-hint">{cfg.hint}</p>
      {/if}

      {#if cfg.type === 'checkbox-group'}
        {@const options = deriveOptions(cfg)}
        {@const current = $filters[cfg.id]}
        {@const selected = Array.isArray(current) ? current : []}
        {#each options as opt (opt)}
          <Checkbox
            id="filter-{cfg.id}-{opt}"
            label={opt}
            checked={selected.includes(opt)}
            onchange={(v) => toggleCheckbox(cfg.id, opt, v)}
          />
        {/each}
        {#if options.length === 0}
          <p class="usa-hint filter-empty">No options available yet.</p>
        {/if}
      {:else if cfg.type === 'date-range'}
        {@const dr = ($filters[cfg.id] as DateRangeValue | undefined) ?? {}}
        <DateRangePicker
          idPrefix="filter-{cfg.id}"
          start={dr.start ?? ''}
          end={dr.end ?? ''}
          onStartChange={(v) => updateFilter(cfg.id, { ...dr, start: v || undefined })}
          onEndChange={(v) => updateFilter(cfg.id, { ...dr, end: v || undefined })}
        />
      {:else if cfg.type === 'number-range'}
        {@const nr = ($filters[cfg.id] as NumberRangeValue | undefined) ?? {}}
        <div class="number-range">
          <label class="usa-label" for="filter-{cfg.id}-min">Min</label>
          <input
            class="usa-input"
            id="filter-{cfg.id}-min"
            type="number"
            value={nr.min ?? ''}
            oninput={(e) => {
              const raw = (e.currentTarget as HTMLInputElement).value;
              const n = raw === '' ? undefined : Number(raw);
              updateFilter(cfg.id, { ...nr, min: Number.isFinite(n) ? n : undefined });
            }}
          />
          <label class="usa-label" for="filter-{cfg.id}-max">Max</label>
          <input
            class="usa-input"
            id="filter-{cfg.id}-max"
            type="number"
            value={nr.max ?? ''}
            oninput={(e) => {
              const raw = (e.currentTarget as HTMLInputElement).value;
              const n = raw === '' ? undefined : Number(raw);
              updateFilter(cfg.id, { ...nr, max: Number.isFinite(n) ? n : undefined });
            }}
          />
        </div>
      {/if}
    </Accordion>
  {/each}
</aside>

<style>
  .filter-panel {
    padding: 1rem 0;
  }
  .filter-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  .filter-empty {
    font-style: italic;
  }
  .number-range {
    display: grid;
    grid-template-columns: auto 1fr auto 1fr;
    align-items: center;
    gap: 0.5rem;
  }
</style>
