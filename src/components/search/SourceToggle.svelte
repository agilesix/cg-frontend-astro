<script lang="ts">
  import { enabledSources } from '@/stores/searchStore';
  import type { SourceId } from '@/client/federation/source';
  import Checkbox from '@/components/uswds/Checkbox.svelte';

  interface Props {
    available: Array<{ id: SourceId; label: string }>;
  }

  let { available }: Props = $props();

  function toggle(id: SourceId, checked: boolean) {
    // Local dedup set — not reactive state; plain Set is fine.
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const next = new Set($enabledSources);
    if (checked) next.add(id);
    else next.delete(id);
    if (next.size === 0) return; // disallow empty selection
    enabledSources.set([...next] as SourceId[]);
  }
</script>

{#if available.length > 1}
  <fieldset class="usa-fieldset source-toggle">
    <legend class="usa-legend">Sources</legend>
    {#each available as source (source.id)}
      <Checkbox
        id="src-{source.id}"
        label={source.label}
        checked={$enabledSources.includes(source.id)}
        onchange={(v) => toggle(source.id, v)}
      />
    {/each}
  </fieldset>
{/if}

<style>
  .source-toggle {
    border: 0;
    padding: 0;
    margin-bottom: 1rem;
  }
</style>
