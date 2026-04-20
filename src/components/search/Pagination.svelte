<script lang="ts">
  import { page } from '@/stores/searchStore';
  import { totalPagesCount } from '@/stores/resultsStore';
  import PaginationBar from '@/components/uswds/PaginationBar.svelte';

  function goTo(n: number) {
    page.set(n);
    // Scroll the results list back to the top on page change.
    document
      .querySelector('.results-list, .empty-state, .skeleton-list')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<PaginationBar currentPage={$page} totalPages={$totalPagesCount} onPageChange={goTo} />
