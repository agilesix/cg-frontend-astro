<script lang="ts">
  import { activeTab, pagesByTab, setPage } from '@/stores/searchStore';
  import { totalPagesCount } from '@/stores/resultsStore';
  import PaginationBar from '@/components/uswds/PaginationBar.svelte';

  function goTo(n: number) {
    setPage(n);
    document
      .querySelector('.results-list, .empty-state, .skeleton-list')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
</script>

<PaginationBar
  currentPage={$pagesByTab[$activeTab] ?? 1}
  totalPages={$totalPagesCount}
  onPageChange={goTo}
/>
