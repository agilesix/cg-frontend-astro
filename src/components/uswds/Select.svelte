<script lang="ts">
  interface Option {
    value: string;
    label: string;
  }
  interface Props {
    id: string;
    label: string;
    options: readonly Option[];
    value: string;
    hint?: string;
    onchange?: (value: string) => void;
  }

  let { id, label, options, value, hint, onchange }: Props = $props();

  function handleChange(e: Event) {
    const target = e.currentTarget as HTMLSelectElement;
    onchange?.(target.value);
  }
</script>

<div class="usa-form-group">
  <label class="usa-label" for={id}>{label}</label>
  {#if hint}
    <span class="usa-hint">{hint}</span>
  {/if}
  <select class="usa-select" {id} {value} onchange={handleChange}>
    {#each options as opt (opt.value)}
      <option value={opt.value}>{opt.label}</option>
    {/each}
  </select>
</div>
