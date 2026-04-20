// USWDS publishes its compiled CSS under dist/ but its package.json exports
// map doesn't expose those files as importable subpaths. Rather than fight
// Vite's strict resolution, we stage the assets we need into src/styles/ and
// public/uswds/ at install time.
//
// Run via `pnpm run prepare` (fires on `pnpm install`) or manually.

import { mkdir, cp, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const uswds = resolve(root, 'node_modules/@uswds/uswds/dist');

if (!existsSync(uswds)) {
  console.warn('[copy-uswds] Skipping — @uswds/uswds not installed yet.');
  process.exit(0);
}

await mkdir(resolve(root, 'src/styles'), { recursive: true });
await copyFile(resolve(uswds, 'css/uswds.min.css'), resolve(root, 'src/styles/uswds.min.css'));
// Copy the source map so Vite doesn't log an ENOENT every time the CSS loads.
await copyFile(
  resolve(uswds, 'css/uswds.min.css.map'),
  resolve(root, 'src/styles/uswds.min.css.map'),
);

// Fonts, images, and the SVG sprite are referenced by the CSS via
// `url(../fonts/...)` / `url(../img/...)`. Stage them in /public so they
// resolve at runtime relative to the page, and so Vite doesn't try to rewrite
// them during CSS bundling.
const publicUswds = resolve(root, 'public/uswds');
await mkdir(publicUswds, { recursive: true });
for (const sub of ['fonts', 'img']) {
  const src = resolve(uswds, sub);
  if (existsSync(src)) {
    await cp(src, resolve(publicUswds, sub), { recursive: true });
  }
}

console.log('[copy-uswds] Done.');
