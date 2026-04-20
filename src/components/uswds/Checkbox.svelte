<script lang="ts">
  interface Props {
    id: string;
    label: string;
    checked?: boolean;
    disabled?: boolean;
    hint?: string;
    onchange?: (checked: boolean) => void;
  }

  let { id, label, checked = false, disabled = false, hint, onchange }: Props = $props();

  function handleChange(e: Event) {
    const target = e.currentTarget as HTMLInputElement;
    onchange?.(target.checked);
  }
</script>

<div class="usa-checkbox">
  <input
    class="usa-checkbox__input"
    type="checkbox"
    {id}
    {disabled}
    {checked}
    onchange={handleChange}
  />
  <label class="usa-checkbox__label" for={id}>
    {label}
    {#if hint}
      <span class="usa-checkbox__label-description">{hint}</span>
    {/if}
  </label>
</div>
