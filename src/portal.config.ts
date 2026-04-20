import type { PortalConfig } from '@/types/portal';

/**
 * The one place portal-level UX is declared: which filters appear, which
 * detail cards render, and in what order.
 *
 * Filter IDs hardcoded into `filterMapping.toOppFilters()` for server-side
 * translation: `status`, `closeDate`, `funding`. Other server-side filter IDs
 * are ignored by the mapper (documented there).
 *
 * Client-side filters use `fieldPath` to read a value out of the parsed
 * Opportunity. Custom plugin fields live under `customFields.<key>.value`
 * (per the SDK's `withCustomFields` wrapping). For example, PA's category
 * lives at `customFields.paCategory.value`.
 */
export const portalConfig: PortalConfig = {
  filters: [
    {
      id: 'status',
      label: 'Status',
      mode: 'server',
      type: 'checkbox-group',
      options: ['open', 'forecasted', 'closed'],
      defaultOpen: true,
    },
    {
      id: 'closeDate',
      label: 'Close date',
      mode: 'server',
      type: 'date-range',
    },
    {
      id: 'funding',
      label: 'Maximum award',
      mode: 'server',
      type: 'number-range',
      hint: 'Enter amounts in whole dollars',
    },
    {
      id: 'paCategory',
      label: 'PA category',
      mode: 'client',
      type: 'checkbox-group',
      sourceFilter: 'pa',
      fieldPath: 'customFields.paCategory.value',
      optionsSource: 'derive',
    },
    {
      id: 'paFundingType',
      label: 'PA funding type',
      mode: 'client',
      type: 'checkbox-group',
      sourceFilter: 'pa',
      fieldPath: 'customFields.paFundingType.value',
      optionsSource: 'derive',
    },
    {
      id: 'federalAgency',
      label: 'Federal agency',
      mode: 'client',
      type: 'checkbox-group',
      sourceFilter: 'federal',
      fieldPath: 'customFields.agency.value.name',
      optionsSource: 'derive',
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
