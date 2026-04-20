import type { SourceId } from '@/client/federation/source';

export type FilterMode = 'server' | 'client';

export type FilterType = 'checkbox-group' | 'date-range' | 'number-range' | 'select';

export interface FilterConfig {
  /** Stable identifier. Must be unique across the portal config. */
  id: string;
  /** User-facing label rendered above the control. */
  label: string;
  /** Whether the filter is applied by the API (`server`) or after merge (`client`). */
  mode: FilterMode;
  /** Rendered control type. */
  type: FilterType;
  /** Short helper text shown beneath the control. */
  hint?: string;
  /** Whether the accordion panel is expanded by default. */
  defaultOpen?: boolean;
  /** Static options for checkbox-group / select. */
  options?: readonly string[];
  /**
   * How to enumerate options for checkbox-group / select when not static.
   * `'derive'` reads unique values from the current $rawItems.
   */
  optionsSource?: 'derive';
  /**
   * Only applies to client-side filters. When set, the filter predicate is
   * only evaluated against items from this source. Items from other sources
   * are not excluded.
   */
  sourceFilter?: SourceId;
  /**
   * Only applies to client-side filters. Dot-notation path into the parsed
   * Opportunity, e.g. `'keyDates.closeDate'` or `'customFields.agency.value.name'`.
   */
  fieldPath?: string;
}

export interface KeyFactConfig {
  term: string;
  fieldPath: string;
  hint?: string;
}

export interface KeyFactsCardConfig {
  heading: string;
  /** Restrict this card to items from a specific source. Omit for universal cards. */
  sourceFilter?: SourceId;
  facts: KeyFactConfig[];
}

export interface PortalConfig {
  filters: readonly FilterConfig[];
  keyFactsCards: readonly KeyFactsCardConfig[];
}
