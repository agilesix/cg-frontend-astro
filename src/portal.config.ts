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
        california: { fieldPath: 'keyDates.closeDate' },
      },
    },
    {
      id: 'funding',
      label: 'Maximum award',
      type: 'number-range',
      hint: 'Enter amounts in whole dollars',
      perSource: {
        pa: { fieldPath: 'funding.maxAwardAmount.amount' },
        federal: { fieldPath: 'funding.maxAwardAmount.amount' },
        california: { fieldPath: 'funding.maxAwardAmount.amount' },
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
        california: { fieldPath: 'customFields.caCategories.value' },
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
        california: { fieldPath: 'customFields.agency.value.name' },
      },
    },
  ],

  // Sections are grouped semantically (key dates, funding, eligibility,
  // contact) and mix standard fields with the relevant custom fields. Rows
  // whose value is null are dropped, and a card with no surviving rows is not
  // rendered — so source-specific facts (PA `pa*`, CA `ca*`, federal) can
  // share a universal card and simply disappear for sources that lack them.
  keyFactsCards: [
    {
      heading: 'Key dates',
      facts: [
        { term: 'Posted', fieldPath: 'keyDates.postDate', format: 'date' },
        { term: 'Closes', fieldPath: 'keyDates.closeDate', format: 'date' },
        // CA expected-award / period are free-form strings, not dates.
        { term: 'Expected award', fieldPath: 'customFields.caExpAwardDate.value', format: 'text' },
        { term: 'Award period', fieldPath: 'customFields.caAwardPeriod.value', format: 'text' },
      ],
    },
    {
      heading: 'Funding',
      facts: [
        { term: 'Minimum award', fieldPath: 'funding.minAwardAmount.amount', format: 'currency' },
        { term: 'Maximum award', fieldPath: 'funding.maxAwardAmount.amount', format: 'currency' },
        {
          term: 'Total available',
          fieldPath: 'funding.totalAmountAvailable.amount',
          format: 'currency',
        },
        { term: 'Funding source', fieldPath: 'customFields.fundingSource.value', format: 'text' },
        {
          term: 'Funding instrument',
          fieldPath: 'customFields.fundingInstrument.value',
          format: 'text',
        },
        // CA-specific.
        { term: 'Funding method', fieldPath: 'customFields.caFundingMethod.value', format: 'text' },
        {
          term: 'Cost sharing required',
          fieldPath: 'customFields.costSharing.value.isRequired',
          format: 'boolean',
        },
        {
          term: 'Cost sharing details',
          fieldPath: 'customFields.costSharing.value.details',
          format: 'text',
        },
      ],
    },
    {
      heading: 'Eligibility',
      facts: [
        // PA-specific.
        { term: 'Category', fieldPath: 'customFields.paCategory.value', format: 'text' },
        { term: 'Grant cycle', fieldPath: 'customFields.paGrantCycle.value', format: 'text' },
        // CA-specific.
        { term: 'Geography', fieldPath: 'customFields.caGeography.value', format: 'text' },
        {
          term: 'Letter of intent required',
          fieldPath: 'customFields.caLoi.value',
          format: 'boolean',
        },
        {
          term: 'Applicant notes',
          fieldPath: 'customFields.caApplicantTypeNotes.value',
          format: 'text',
        },
      ],
    },
    {
      heading: 'Contact',
      facts: [
        { term: 'Name', fieldPath: 'customFields.contactInfo.value.name', format: 'text' },
        { term: 'Email', fieldPath: 'customFields.contactInfo.value.email', format: 'text' },
        { term: 'Phone', fieldPath: 'customFields.contactInfo.value.phone', format: 'text' },
      ],
    },
    {
      heading: 'Federal details',
      sourceFilter: 'federal',
      facts: [
        {
          term: 'Federal opportunity number',
          fieldPath: 'customFields.federalOpportunityNumber.value',
          format: 'text',
        },
        { term: 'Fiscal year', fieldPath: 'customFields.fiscalYear.value', format: 'text' },
        {
          term: 'Funding source',
          fieldPath: 'customFields.federalFundingSource.value',
          format: 'text',
        },
      ],
    },
  ],
};
