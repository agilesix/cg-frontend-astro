import { describe, expect, it } from 'vitest';
import { asHttpUrl } from '@/lib/format';

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
