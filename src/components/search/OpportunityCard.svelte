<script lang="ts">
  import type { SourceId } from '@/client/federation/source';
  import { SOURCE_LABELS } from '@/client/federation/source';
  import Tag from '@/components/uswds/Tag.svelte';
  import { formatDate, formatFundingRange, getByPath } from '@/lib/format';

  interface Props {
    opportunity: unknown;
    /** Source the opportunity came from. Drives the badge + detail URL. */
    source: SourceId;
  }

  let { opportunity, source }: Props = $props();

  const sourceLabel = $derived(SOURCE_LABELS[source]);
  const sourceVariant = $derived<`source-${SourceId}`>(`source-${source}`);

  const id = $derived(String(getByPath(opportunity, 'id') ?? ''));
  const title = $derived(String(getByPath(opportunity, 'title') ?? 'Untitled opportunity'));
  const statusValue = $derived(String(getByPath(opportunity, 'status.value') ?? ''));
  const statusVariant = $derived<'open' | 'forecasted' | 'closed' | 'default'>(
    statusValue === 'open' || statusValue === 'forecasted' || statusValue === 'closed'
      ? statusValue
      : 'default',
  );
  const agency = $derived(String(getByPath(opportunity, 'customFields.agency.value.name') ?? ''));
  const closeDate = $derived(formatDate(getByPath(opportunity, 'keyDates.closeDate')));
  const funding = $derived(
    formatFundingRange(
      getByPath(opportunity, 'fundingDetails.minAwardAmount.amount'),
      getByPath(opportunity, 'fundingDetails.maxAwardAmount.amount'),
    ),
  );
  const href = $derived(`/opportunities/${source}/${encodeURIComponent(id)}`);
</script>

<article class="opportunity-card">
  <div class="tags">
    <Tag label={sourceLabel} variant={sourceVariant} />
    {#if statusValue}
      <Tag label={statusValue} variant={statusVariant} />
    {/if}
  </div>
  <h3 class="card-title">
    <a {href}>{title}</a>
  </h3>
  {#if agency}
    <p class="card-meta">{agency}</p>
  {/if}
  <p class="card-meta">
    {#if closeDate}
      Closes {closeDate} ·
    {/if}
    {funding}
  </p>
</article>

<style>
  .opportunity-card {
    border: 1px solid #dfe1e2;
    padding: 1rem;
    margin-bottom: 1rem;
    background: #fff;
  }
  .tags {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }
  .card-title {
    font-size: 1.125rem;
    margin: 0 0 0.25rem;
  }
  .card-title a {
    color: #005ea2;
    text-decoration: none;
  }
  .card-title a:hover {
    text-decoration: underline;
  }
  .card-meta {
    margin: 0.25rem 0;
    color: #565c65;
    font-size: 0.9375rem;
  }
</style>
