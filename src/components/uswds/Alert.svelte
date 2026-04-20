<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    type?: 'info' | 'success' | 'warning' | 'error';
    heading?: string;
    slim?: boolean;
    children?: Snippet;
  }

  let { type = 'info', heading, slim = false, children }: Props = $props();
</script>

<div class="usa-alert usa-alert--{type}" class:usa-alert--slim={slim} role="alert">
  <div class="usa-alert__body">
    {#if heading}
      <h3 class="usa-alert__heading">{heading}</h3>
    {/if}
    <p class="usa-alert__text">{@render children?.()}</p>
  </div>
</div>
