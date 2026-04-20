import { describe, it, expect } from 'vitest';
import { toOppFilters, applyClientFilters } from '@/client/filterMapping';
import type { FilterConfig } from '@/types/portal';
import type { Tagged } from '@/client/federation/source';

const serverCfg: readonly FilterConfig[] = [
  { id: 'status', label: 'Status', mode: 'server', type: 'checkbox-group' },
  { id: 'closeDate', label: 'Close date', mode: 'server', type: 'date-range' },
  { id: 'funding', label: 'Funding', mode: 'server', type: 'number-range' },
];

describe('toOppFilters', () => {
  it('returns empty object when no filters active', () => {
    expect(toOppFilters({}, serverCfg)).toEqual({});
  });

  it('maps status to { operator: in, value: [...] }', () => {
    expect(toOppFilters({ status: ['open', 'forecasted'] }, serverCfg)).toEqual({
      status: { operator: 'in', value: ['open', 'forecasted'] },
    });
  });

  it('skips empty-array status', () => {
    expect(toOppFilters({ status: [] }, serverCfg)).toEqual({});
  });

  it('maps closeDate range with both bounds', () => {
    expect(
      toOppFilters({ closeDate: { start: '2026-01-01', end: '2026-12-31' } }, serverCfg),
    ).toEqual({
      closeDateRange: { operator: 'between', value: { min: '2026-01-01', max: '2026-12-31' } },
    });
  });

  it('maps closeDate with only start (open-ended upper)', () => {
    const out = toOppFilters({ closeDate: { start: '2026-01-01' } }, serverCfg);
    expect(out.closeDateRange?.value.min).toBe('2026-01-01');
    expect(out.closeDateRange?.value.max).toBe('2999-12-31');
  });

  it('maps funding range as maxAwardAmountRange with USD', () => {
    const out = toOppFilters({ funding: { min: 1000, max: 100000 } }, serverCfg);
    expect(out.maxAwardAmountRange?.operator).toBe('between');
    expect(out.maxAwardAmountRange?.value.min).toEqual({ amount: '1000', currency: 'USD' });
    expect(out.maxAwardAmountRange?.value.max).toEqual({ amount: '100000', currency: 'USD' });
  });

  it('ignores client-mode filters', () => {
    const cfg: readonly FilterConfig[] = [
      ...serverCfg,
      { id: 'paCategory', label: 'PA Cat', mode: 'client', type: 'checkbox-group' },
    ];
    const out = toOppFilters({ status: ['open'], paCategory: ['Agriculture'] }, cfg);
    expect(out.status).toBeDefined();
    expect('paCategory' in out).toBe(false);
  });

  it('ignores unknown server filter IDs without throwing', () => {
    const cfg: readonly FilterConfig[] = [
      { id: 'neverWired', label: 'X', mode: 'server', type: 'checkbox-group' },
    ];
    expect(toOppFilters({ neverWired: ['a'] }, cfg)).toEqual({});
  });
});

const clientCfg: readonly FilterConfig[] = [
  {
    id: 'paCategory',
    label: 'PA Cat',
    mode: 'client',
    type: 'checkbox-group',
    sourceFilter: 'pa',
    fieldPath: 'customFields.paCategory.value',
  },
];

const paItem = (category: string): Tagged<Record<string, unknown>> => ({
  _source: 'pa',
  customFields: { paCategory: { value: category } },
});

const fedItem = (): Tagged<Record<string, unknown>> => ({
  _source: 'federal',
  customFields: { agency: { value: { name: 'USDA' } } },
});

describe('applyClientFilters', () => {
  it('returns items unchanged when no client filters configured', () => {
    const items = [paItem('A'), fedItem()];
    expect(applyClientFilters(items, {}, [...serverCfg])).toBe(items);
  });

  it('returns items unchanged when no client filter values active', () => {
    const items = [paItem('A'), fedItem()];
    expect(applyClientFilters(items, {}, clientCfg)).toEqual(items);
  });

  it('filters PA items by category, leaves Federal items untouched', () => {
    const items = [paItem('Agriculture'), paItem('Education'), fedItem()];
    const out = applyClientFilters(items, { paCategory: ['Agriculture'] }, clientCfg);
    expect(out).toHaveLength(2);
    expect(out[0]).toBe(items[0]);
    expect(out[1]).toBe(items[2]); // federal pass-through
  });

  it('excludes items missing the filtered field on the target source', () => {
    const items = [{ _source: 'pa' as const, customFields: {} }, paItem('Agriculture')];
    const out = applyClientFilters(items, { paCategory: ['Agriculture'] }, clientCfg);
    expect(out).toHaveLength(1);
    expect(out[0]).toBe(items[1]);
  });

  it('treats empty selection arrays as no filter active', () => {
    const items = [paItem('A'), paItem('B')];
    expect(applyClientFilters(items, { paCategory: [] }, clientCfg)).toEqual(items);
  });
});
