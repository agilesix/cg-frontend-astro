<script lang="ts">
  import { filters, clearAllFilters, activeTab } from '@/stores/searchStore';
  import { activeState } from '@/stores/resultsStore';
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

  function getByPath(obj: unknown, path: string): unknown {
    let cur: unknown = obj;
    for (const seg of path.split('.')) {
      if (cur == null || typeof cur !== 'object') return undefined;
      cur = (cur as Record<string, unknown>)[seg];
    }
    return cur;
  }

  /**
   * Filters with a `perSource` map are only relevant to the active tab if
   * that source has a mapping. Filters with no `perSource` (e.g. `status`)
   * are universal — always shown.
   */
  function appliesToActive(cfg: FilterConfig): boolean {
    if (!cfg.perSource) return true;
    return cfg.perSource[$activeTab] !== undefined;
  }

  function fieldPathFor(cfg: FilterConfig): string | undefined {
    return cfg.perSource?.[$activeTab]?.fieldPath;
  }

  function deriveOptions(cfg: FilterConfig): readonly string[] {
    if (cfg.options) return cfg.options;
    if (cfg.optionsSource !== 'derive') return [];
    const path = fieldPathFor(cfg);
    if (!path) return [];
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const seen = new Set<string>();
    for (const item of $activeState.items) {
      const val = getByPath(item, path);
      if (typeof val === 'string' && val) seen.add(val);
      else if (Array.isArray(val)) {
        for (const v of val) if (typeof v === 'string' && v) seen.add(v);
      }
    }
    return [...seen].sort((a, b) => a.localeCompare(b));
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
    {#if appliesToActive(cfg)}
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
            <div class="number-range__field">
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
            </div>
            <div class="number-range__field">
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
          </div>
        {/if}
      </Accordion>
    {/if}
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
  /* Stacked: Min above Max so neither input gets squashed in the sidebar. */
  .number-range {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .number-range__field {
    display: flex;
    flex-direction: column;
  }
  /* Tighten USWDS's default top margin on labels inside the stacked field. */
  .number-range__field .usa-label {
    margin-top: 0;
  }
</style>
