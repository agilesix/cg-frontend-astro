import { describe, it, expect } from 'vitest';
import { sortMerged, paginate, totalPages } from '@/client/federation/pipeline';

interface Item {
  id: string;
  keyDates: { closeDate?: string | null };
}

const items: Item[] = [
  { id: 'a', keyDates: { closeDate: '2026-06-01' } },
  { id: 'b', keyDates: { closeDate: '2026-03-15' } },
  { id: 'c', keyDates: { closeDate: null } },
  { id: 'd', keyDates: { closeDate: '2026-12-01' } },
];

describe('sortMerged', () => {
  it('sorts ascending by nested path', () => {
    const out = sortMerged(items, 'keyDates.closeDate', 'asc').map((i) => i.id);
    expect(out).toEqual(['b', 'a', 'd', 'c']); // null last
  });

  it('sorts descending with nulls still last', () => {
    const out = sortMerged(items, 'keyDates.closeDate', 'desc').map((i) => i.id);
    expect(out).toEqual(['d', 'a', 'b', 'c']);
  });

  it('does not mutate input', () => {
    const orig = [...items];
    sortMerged(items, 'keyDates.closeDate', 'asc');
    expect(items).toEqual(orig);
  });
});

describe('paginate', () => {
  const arr = Array.from({ length: 23 }, (_, i) => i);

  it('returns correct slice for page 1', () => {
    expect(paginate(arr, 1, 10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('returns correct slice for last partial page', () => {
    expect(paginate(arr, 3, 10)).toEqual([20, 21, 22]);
  });

  it('returns empty for page past the end', () => {
    expect(paginate(arr, 5, 10)).toEqual([]);
  });
});

describe('totalPages', () => {
  it('rounds up non-exact divisions', () => {
    expect(totalPages(23, 10)).toBe(3);
  });

  it('returns 1 for empty sets (UI still renders an empty list)', () => {
    expect(totalPages(0, 10)).toBe(1);
  });

  it('returns exact quotient when divisible', () => {
    expect(totalPages(20, 10)).toBe(2);
  });
});
