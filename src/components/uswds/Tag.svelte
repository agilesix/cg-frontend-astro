<script lang="ts">
  interface Props {
    label: string;
    variant?: 'default' | 'open' | 'forecasted' | 'closed' | 'source-pa' | 'source-federal';
    onRemove?: () => void;
  }

  let { label, variant = 'default', onRemove }: Props = $props();
</script>

<span class="usa-tag tag tag--{variant}">
  <span class="tag-label">{label}</span>
  {#if onRemove}
    <button type="button" class="tag-remove" aria-label="Remove {label}" onclick={onRemove}>
      ×
    </button>
  {/if}
</span>

<style>
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }
  .tag-remove {
    background: transparent;
    border: 0;
    color: inherit;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
    padding: 0 0.125rem;
  }
  .tag-remove:hover {
    text-decoration: underline;
  }
  .tag--open {
    background-color: #00a91c;
    color: #fff;
  }
  .tag--forecasted {
    background-color: #0076d6;
    color: #fff;
  }
  .tag--closed {
    background-color: #757575;
    color: #fff;
  }
  .tag--source-pa {
    background-color: #112e51;
    color: #fff;
  }
  .tag--source-federal {
    background-color: #2e8540;
    color: #fff;
  }
</style>
