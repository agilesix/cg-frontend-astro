import type { Source } from './federation/source';

export interface DateRangeValue {
  start?: string;
  end?: string;
}

export interface NumberRangeValue {
  min?: number;
  max?: number;
}

export type FilterValue = string | string[] | DateRangeValue | NumberRangeValue | undefined;

export type ActiveFilters = Record<string, FilterValue>;

export type SortOrder = 'asc' | 'desc';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace App {
    interface Locals {
      sources: Source[];
    }
  }
}
