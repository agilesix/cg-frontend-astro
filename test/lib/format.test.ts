import { afterEach, describe, expect, it } from 'vitest';
import { asHttpUrl, formatDate } from '@/lib/format';

const originalTimezone = process.env.TZ;

afterEach(() => {
  process.env.TZ = originalTimezone;
});

describe('formatDate', () => {
  it('renders bare date-only strings as civil dates', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(formatDate('2026-07-31')).toBe('Jul 31, 2026');
  });

  it.each([
    {
      label: 'date-only single date',
      event: { eventType: 'singleDate', date: '2026-07-31', time: '00:00:00' },
    },
    {
      label: 'SDK single date',
      event: {
        eventType: 'singleDate',
        date: new Date('2026-07-31T00:00:00.000Z'),
        time: '00:00:00',
      },
    },
    {
      label: 'serialized SDK single date',
      event: {
        eventType: 'singleDate',
        date: '2026-07-31T00:00:00.000Z',
        time: '00:00:00',
      },
    },
    {
      label: 'SDK date range',
      event: {
        eventType: 'dateRange',
        startDate: new Date('2026-07-01T00:00:00.000Z'),
        endDate: new Date('2026-07-31T00:00:00.000Z'),
      },
    },
    {
      label: 'serialized SDK date range',
      event: {
        eventType: 'dateRange',
        startDate: '2026-07-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
      },
    },
  ])('renders $label as a civil date', ({ event }) => {
    process.env.TZ = 'America/Los_Angeles';

    expect(formatDate(event)).toBe('Jul 31, 2026');
  });

  it('uses the range start date when an end date is unavailable', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(
      formatDate({
        eventType: 'dateRange',
        startDate: '2026-07-01T00:00:00.000Z',
      }),
    ).toBe('Jul 1, 2026');
  });

  it('retains local-time rendering for timestamp values', () => {
    process.env.TZ = 'America/Los_Angeles';

    expect(formatDate('2026-07-31T00:00:00Z')).toBe('Jul 30, 2026');
  });
});

describe('asHttpUrl', () => {
  it('keeps valid HTTP(S) URLs', () => {
    expect(asHttpUrl('https://fundhub.wa.gov/funding/example/')).toBe(
      'https://fundhub.wa.gov/funding/example/',
    );
    expect(asHttpUrl('http://localhost:4321/example')).toBe('http://localhost:4321/example');
  });

  it.each([
    'http://_blank',
    'http://-',
    'http://.',
    'http://a..b',
    'http://-example.com',
    'javascript:alert(1)',
    '/relative/path',
    '',
  ])('rejects unusable external URL %s', (value) => {
    expect(asHttpUrl(value)).toBeNull();
  });
});
