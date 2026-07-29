import { describe, expect, it } from 'vitest';
import { getOpportunityAttachments, getOpportunitySourceUrl } from '@/lib/opportunityLinks';

describe('getOpportunitySourceUrl', () => {
  it('prefers a valid Washington application URL', () => {
    expect(
      getOpportunitySourceUrl({
        source: 'https://fundhub.wa.gov/funding/example/',
        customFields: {
          waApplicationLinkUrl: { value: 'https://apply.wa.gov/example' },
        },
      }),
    ).toBe('https://apply.wa.gov/example');
  });

  it('falls back to source when the Washington application URL is malformed', () => {
    expect(
      getOpportunitySourceUrl({
        source: 'https://fundhub.wa.gov/funding/example/',
        customFields: { waApplicationLinkUrl: { value: 'http://_blank' } },
      }),
    ).toBe('https://fundhub.wa.gov/funding/example/');
  });

  it('uses the canonical source instead of a general-information page', () => {
    expect(
      getOpportunitySourceUrl({
        source: 'https://grants.pa.gov/Login.aspx',
        customFields: {
          additionalInfo: {
            value: {
              url: 'https://www.pa.gov/en/agencies/example.html',
              description: 'Issuing agency homepage',
            },
          },
        },
      }),
    ).toBe('https://grants.pa.gov/Login.aspx');
  });

  it('supports a federal source URL', () => {
    expect(getOpportunitySourceUrl({ source: 'https://simpler.grants.gov/opportunity/123' })).toBe(
      'https://simpler.grants.gov/opportunity/123',
    );
  });
});

describe('getOpportunityAttachments', () => {
  it('keeps safe attachments and drops unsafe URLs', () => {
    expect(
      getOpportunityAttachments({
        customFields: {
          attachments: {
            value: [
              { name: 'NOFO', downloadUrl: 'https://example.gov/nofo.pdf' },
              { name: 'Unsafe', url: 'javascript:alert(1)' },
            ],
          },
        },
      }),
    ).toEqual([{ href: 'https://example.gov/nofo.pdf', label: 'NOFO' }]);
  });
});
