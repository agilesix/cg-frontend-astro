<script lang="ts">
  interface Props {
    label?: string;
  }
  let { label = 'Loading' }: Props = $props();
</script>

<div class="loading-spinner" role="status" aria-live="polite">
  <span class="spinner" aria-hidden="true"></span>
  <span class="usa-sr-only">{label}</span>
</div>

<style>
  .loading-spinner {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }
  .spinner {
    width: 1.25rem;
    height: 1.25rem;
    border: 2px solid #dfe1e2;
    border-top-color: #005ea2;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .usa-sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
