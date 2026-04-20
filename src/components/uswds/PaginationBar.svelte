<script lang="ts">
  interface Props {
    currentPage: number;
    totalPages: number;
    maxVisible?: number;
    onPageChange?: (page: number) => void;
  }

  let { currentPage, totalPages, maxVisible = 7, onPageChange }: Props = $props();

  /** Returns an array like [1, 'gap', 4, 5, 6, 'gap', 10] for the pagination UI. */
  const pages = $derived.by(() => {
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => (i + 1) as number | 'gap');
    }
    const result: Array<number | 'gap'> = [1];
    const side = Math.floor((maxVisible - 3) / 2);
    const start = Math.max(2, currentPage - side);
    const end = Math.min(totalPages - 1, currentPage + side);
    if (start > 2) result.push('gap');
    for (let i = start; i <= end; i++) result.push(i);
    if (end < totalPages - 1) result.push('gap');
    result.push(totalPages);
    return result;
  });

  function go(n: number) {
    if (n < 1 || n > totalPages || n === currentPage) return;
    onPageChange?.(n);
  }
</script>

{#if totalPages > 1}
  <nav class="usa-pagination" aria-label="Pagination">
    <ul class="usa-pagination__list">
      <li class="usa-pagination__item usa-pagination__arrow">
        <button
          type="button"
          class="usa-pagination__link"
          disabled={currentPage === 1}
          onclick={() => go(currentPage - 1)}
        >
          ← Previous
        </button>
      </li>
      {#each pages as p, i (i)}
        {#if p === 'gap'}
          <li class="usa-pagination__item usa-pagination__overflow" aria-label="ellipsis">
            <span>…</span>
          </li>
        {:else}
          <li class="usa-pagination__item usa-pagination__page-no">
            <button
              type="button"
              class="usa-pagination__button"
              class:usa-current={p === currentPage}
              aria-current={p === currentPage ? 'page' : undefined}
              onclick={() => go(p)}
            >
              {p}
            </button>
          </li>
        {/if}
      {/each}
      <li class="usa-pagination__item usa-pagination__arrow">
        <button
          type="button"
          class="usa-pagination__link"
          disabled={currentPage === totalPages}
          onclick={() => go(currentPage + 1)}
        >
          Next →
        </button>
      </li>
    </ul>
  </nav>
{/if}
