<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    id: string;
    heading: string;
    defaultOpen?: boolean;
    hasActiveIndicator?: boolean;
    isActive?: boolean;
    children?: Snippet;
  }

  let {
    id,
    heading,
    defaultOpen = false,
    hasActiveIndicator = false,
    isActive = false,
    children,
  }: Props = $props();

  // Initialize from the prop once. `defaultOpen` is consulted only at mount;
  // subsequent toggles come from user clicks. The Svelte warning about
  // capturing the initial value is exactly the behavior we want here.
  // svelte-ignore state_referenced_locally
  let open = $state(defaultOpen);
</script>

<div class="usa-accordion usa-accordion--bordered">
  <h3 class="usa-accordion__heading">
    <button
      type="button"
      class="usa-accordion__button"
      aria-expanded={open}
      aria-controls={id}
      onclick={() => (open = !open)}
    >
      {heading}
      {#if hasActiveIndicator && isActive}
        <span class="accordion-active-dot" aria-label="filter active"></span>
      {/if}
    </button>
  </h3>
  <div {id} class="usa-accordion__content" hidden={!open}>
    {@render children?.()}
  </div>
</div>

<style>
  .accordion-active-dot {
    display: inline-block;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background-color: #0076d6;
    margin-left: 0.5rem;
  }
</style>
