import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { APIContext } from 'astro';
const upstream = vi.hoisted(() => ({
  getSourceDescriptors: vi.fn(),
  getSourceEntry: vi.fn(),
  getFromSource: vi.fn(),
  searchSource: vi.fn(),
}));
vi.mock('@/server/upstream', () => upstream);
import { GET } from '@/pages/api/sources/[source]/opportunities/[id]';
import { POST } from '@/pages/api/sources/[source]/search';
const id = '11111111-1111-4111-8111-111111111111';
const context = (source = 'pa', opportunityId = id) =>
  ({ params: { source, id: opportunityId } }) as unknown as APIContext;
beforeEach(() => {
  vi.resetAllMocks();
  upstream.getSourceDescriptors.mockReturnValue([{ id: 'pa', label: 'Pennsylvania' }]);
  upstream.getSourceEntry.mockReturnValue({ id: 'pa', label: 'Pennsylvania' });
});
describe('same-origin detail endpoint', () => {
  it.each(['unknown', 'california', 'ca', '__proto__'])(
    'rejects unknown/unconfigured source %s before retrieval',
    async (source) => {
      expect((await GET(context(source))).status).toBe(404);
      expect(upstream.getFromSource).not.toHaveBeenCalled();
    },
  );
  it.each(['not-a-uuid', '../search', 'x'.repeat(2000), ''])(
    'rejects invalid IDs',
    async (invalid) => {
      expect((await GET(context('pa', invalid))).status).toBe(400);
      expect(upstream.getFromSource).not.toHaveBeenCalled();
    },
  );
  it('returns 404 for a missing opportunity', async () => {
    upstream.getFromSource.mockResolvedValue(null);
    expect((await GET(context())).status).toBe(404);
  });
  it('returns redacted 502 for service errors', async () => {
    upstream.getFromSource.mockRejectedValue(new Error('token=secret upstream 401'));
    const result = await GET(context());
    expect(result.status).toBe(502);
    expect(await result.text()).toBe('Grant source unavailable');
  });
  it('returns complete service detail with no-store', async () => {
    const opportunity = { id, title: 'Test', customFields: { preserved: true } };
    upstream.getFromSource.mockResolvedValue(opportunity);
    const result = await GET(context());
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(await result.json()).toEqual(opportunity);
  });
});
describe('same-origin search errors', () => {
  it.each([401, 403, 500])(
    'does not disguise upstream %s as empty success or expose credentials',
    async (status) => {
      const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
      upstream.searchSource.mockRejectedValue(new Error(`Upstream ${status}: token=secret`));
      try {
        const result = await POST({
          ...context(),
          request: new Request('https://example.test/api/sources/pa/search', {
            method: 'POST',
            body: '{}',
          }),
        });
        expect(result.status).toBe(502);
        expect(await result.json()).toEqual({ error: 'Grant source unavailable' });
        expect(warning).toHaveBeenCalledWith('[Pennsylvania] search unavailable');
      } finally {
        warning.mockRestore();
      }
    },
  );
});
