import assert from 'node:assert/strict';

const base = new URL(process.env.PREVIEW_URL);
assert.equal(base.protocol, 'https:', 'Preview must use HTTPS');

for (const path of ['/', '/search']) {
  const response = await fetch(new URL(path, base), {
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, 200, `${path} did not load`);
  assert.match(response.headers.get('content-type') ?? '', /text\/html/);
  const html = await response.text();
  assert.match(html, /Search grant opportunities/, `${path} is missing the search interface`);
  console.log(`PASS ${path}`);
}

console.log('Preview page checks passed. Interactive and WebMCP tests are separate checks.');
