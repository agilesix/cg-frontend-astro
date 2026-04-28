import type { SourceId } from '@/client/federation/source';

export type FilterType = 'checkbox-group' | 'date-range' | 'number-range' | 'select';

export interface PerSourceFilterMapping {
  /**
   * Dot-notation path into the parsed Opportunity, e.g.
   * `'keyDates.closeDate'` or `'customFields.agency.value.name'`. Read by
   * the server when applying this filter for items from this source.
   */
  fieldPath: string;
}

export interface FilterConfig {
  /** Stable identifier. Must be unique across the portal config. */
  id: string;
  /** User-facing label rendered above the control. */
  label: string;
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
   * `'derive'` reads unique values from the active tab's items.
   */
  optionsSource?: 'derive';
  /**
   * Per-source mappings. The active tab tells the server which source's
   * mapping to read. If a source isn't listed AND the filter has any
   * `perSource` entries, the filter is hidden when that tab is active.
   * Filters with NO `perSource` (e.g. `status`) apply universally.
   */
  perSource?: Partial<Record<SourceId, PerSourceFilterMapping>>;
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
