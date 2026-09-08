/** Shared by manual controls and the site-tool input contract. */
export const SORT_OPTIONS = [
  { value: 'keyDates.closeDate:asc', label: 'Close date (soonest)' },
  { value: 'keyDates.closeDate:desc', label: 'Close date (furthest)' },
  { value: 'keyDates.postDate:desc', label: 'Posted (newest)' },
  { value: 'title:asc', label: 'Title (A–Z)' },
  { value: 'funding.maxAwardAmount.amount:asc', label: 'Maximum award (lowest)' },
  { value: 'funding.maxAwardAmount.amount:desc', label: 'Maximum award (highest)' },
] as const;
