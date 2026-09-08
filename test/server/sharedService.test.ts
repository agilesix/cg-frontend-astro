import { describe, expect, it, vi } from 'vitest';
import { OpportunityBaseSchema } from '@common-grants/sdk/schemas';
import { createGrantService, type ICommonGrantsClient } from '@common-grants/grant-service';
import { searchSource, getFromSource } from '@/server/upstream';

describe('installed GitHub service integration', () => {
  it('preserves wire dates and custom fields through collection filters and detail', async () => {
    const opportunity = OpportunityBaseSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      title: 'Closed test grant',
      description: 'Integration fixture',
      status: { value: 'closed' },
      keyDates: { closeDate: { eventType: 'singleDate', name: 'Deadline', date: '2026-08-15' } },
      customFields: { note: { name: 'note', fieldType: 'string', value: 'Preserved' } },
      createdAt: '2026-01-01T00:00:00Z',
      lastModifiedAt: '2026-01-01T00:00:00Z',
    });
    const search = vi.fn(async () => ({
      items: [opportunity],
      paginationInfo: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
    }));
    const service = createGrantService([
      {
        name: 'pa',
        label: 'Pennsylvania',
        searchOpportunities: search,
        getOpportunity: vi.fn(async () => opportunity),
      } as unknown as ICommonGrantsClient,
    ]);
    const entry = { id: 'pa' as const, label: 'Pennsylvania', service };
    const result = await searchSource(entry, {
      filters: { closeDate: { start: '2026-08-01', end: '2026-08-31' } },
    });
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(JSON.parse(JSON.stringify(opportunity)));
    expect(search).toHaveBeenCalledWith({
      query: undefined,
      statuses: undefined,
      pageSize: 100,
      maxItems: 1000,
    });
    expect(await getFromSource(entry, opportunity.id)).toEqual(result.items[0]);
  });
});
