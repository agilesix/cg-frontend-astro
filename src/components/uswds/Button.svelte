<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    variant?: 'primary' | 'secondary' | 'outline' | 'unstyled';
    size?: 'small' | 'normal' | 'big';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    href?: string;
    ariaLabel?: string;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  }

  let {
    variant = 'primary',
    size = 'normal',
    type = 'button',
    disabled = false,
    href,
    ariaLabel,
    onclick,
    children,
  }: Props = $props();

  const classes = $derived(
    [
      'usa-button',
      variant === 'secondary' && 'usa-button--secondary',
      variant === 'outline' && 'usa-button--outline',
      variant === 'unstyled' && 'usa-button--unstyled',
      size === 'small' && 'usa-button--small',
      size === 'big' && 'usa-button--big',
    ]
      .filter(Boolean)
      .join(' '),
  );
</script>

{#if href}
  <a class={classes} {href} aria-label={ariaLabel}>{@render children?.()}</a>
{:else}
  <button class={classes} {type} {disabled} aria-label={ariaLabel} {onclick}>
    {@render children?.()}
  </button>
{/if}
