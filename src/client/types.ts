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
