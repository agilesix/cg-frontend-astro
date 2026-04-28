import type { PortalConfig } from '@/types/portal';

/**
 * Single source of truth for portal-level UX: which filters appear, where
 * to read each filter's value per source, and which detail cards render.
 *
 * Filter definitions are agnostic of "where the filter is applied" — the
 * server's `src/server/filterPushdown.ts` decides whether each filter is
 * pushed down to the SDK's `.search()` call or applied in memory after.
 *
 * `perSource[id].fieldPath` is the dot-notation path into the parsed
 * Opportunity. Custom plugin fields live under `customFields.<key>.value`.
 * A filter without any `perSource` entries (like `status`) applies to
 * every source via canonical handling.
 */
export const portalConfig: PortalConfig = {
  filters: [
    {
      id: 'status',
      label: 'Status',
      type: 'checkbox-group',
      options: ['open', 'forecasted', 'closed'],
      defaultOpen: true,
    },
    {
      id: 'closeDate',
      label: 'Close date',
      type: 'date-range',
      perSource: {
        pa: { fieldPath: 'keyDates.closeDate' },
        federal: { fieldPath: 'keyDates.closeDate' },
      },
    },
    {
      id: 'funding',
      label: 'Maximum award',
      type: 'number-range',
      hint: 'Enter amounts in whole dollars',
      perSource: {
        pa: { fieldPath: 'fundingDetails.maxAwardAmount.amount' },
        federal: { fieldPath: 'fundingDetails.maxAwardAmount.amount' },
      },
    },
    {
      id: 'category',
      label: 'Category',
      type: 'checkbox-group',
      optionsSource: 'derive',
      perSource: {
        pa: { fieldPath: 'customFields.paCategory.value' },
        federal: { fieldPath: 'customFields.federalFundingSource.value' },
      },
    },
    {
      id: 'agency',
      label: 'Agency',
      type: 'checkbox-group',
      optionsSource: 'derive',
      perSource: {
        pa: { fieldPath: 'customFields.agency.value.name' },
        federal: { fieldPath: 'customFields.agency.value.name' },
      },
    },
  ],

  keyFactsCards: [
    {
      heading: 'Timeline',
      facts: [
        { term: 'Post date', fieldPath: 'keyDates.postDate' },
        { term: 'Close date', fieldPath: 'keyDates.closeDate' },
      ],
    },
    {
      heading: 'Funding',
      facts: [
        { term: 'Minimum award', fieldPath: 'fundingDetails.minAwardAmount.amount' },
        { term: 'Maximum award', fieldPath: 'fundingDetails.maxAwardAmount.amount' },
        { term: 'Total available', fieldPath: 'fundingDetails.totalAmountAvailable.amount' },
      ],
    },
    {
      heading: 'Pennsylvania details',
      sourceFilter: 'pa',
      facts: [
        { term: 'Category', fieldPath: 'customFields.paCategory.value' },
        { term: 'Funding type', fieldPath: 'customFields.paFundingType.value' },
        { term: 'Funding source', fieldPath: 'customFields.paFundingSource.value' },
        { term: 'Grant cycle', fieldPath: 'customFields.paGrantCycle.value' },
        { term: 'Matching funds', fieldPath: 'customFields.paMatchingFundsRequirement.value' },
      ],
    },
    {
      heading: 'Federal details',
      sourceFilter: 'federal',
      facts: [
        { term: 'Agency', fieldPath: 'customFields.agency.value.name' },
        {
          term: 'Federal opportunity number',
          fieldPath: 'customFields.federalOpportunityNumber.value',
        },
        { term: 'Fiscal year', fieldPath: 'customFields.fiscalYear.value' },
        { term: 'Funding source', fieldPath: 'customFields.federalFundingSource.value' },
      ],
    },
  ],
};
