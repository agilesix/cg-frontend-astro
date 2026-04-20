/**
 * Minimal HTML sanitizer that runs in Cloudflare Workers without polyfills.
 *
 * `sanitize-html` pulls in Node's `fs`/`path`/`url` and won't load in the
 * Workers runtime. This whitelist-based stripper is narrower in scope — it's
 * meant specifically for rendering opportunity descriptions from trusted
 * CommonGrants APIs where we only need to neutralize the obvious XSS vectors
 * (script tags, inline handlers, javascript: URLs) and drop markup we don't
 * want to style.
 *
 * NOT a general-purpose replacement for sanitize-html. If the threat model
 * widens (e.g. user-submitted HTML from untrusted posters), swap in DOMPurify
 * wrapped in a Workers-compatible DOM.
 */

const ALLOWED_TAGS = new Set([
  'p',
  'a',
  'ul',
  'ol',
  'li',
  'strong',
  'b',
  'em',
  'i',
  'br',
  'h2',
  'h3',
  'h4',
  'blockquote',
]);

// Strip everything inside <script> / <style> including the tags themselves.
const SCRIPT_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;

// Remove `onclick=...`, `onload=...`, etc. from any tag.
const EVENT_HANDLERS = /\s(on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;

// Defuse `href="javascript:..."` — rewrite to `#`.
const JS_HREF = /href\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]+)/gi;

// Match any tag: we keep it if allowed, drop it (keeping content) otherwise.
const ANY_TAG = /<\/?([a-z][a-z0-9]*)(?:\s[^>]*)?\/?>/gi;

export function sanitizeHtml(input: string): string {
  if (!input) return '';
  let out = input.replace(SCRIPT_STYLE, '');
  out = out.replace(EVENT_HANDLERS, '');
  out = out.replace(JS_HREF, 'href="#"');
  out = out.replace(ANY_TAG, (match, tagName: string) =>
    ALLOWED_TAGS.has(tagName.toLowerCase()) ? forceAnchorSafety(match, tagName) : '',
  );
  return out;
}

// For <a> tags, force target/_blank + rel="noopener noreferrer" so sanitized
// output doesn't create tabnabbing opportunities.
function forceAnchorSafety(tag: string, tagName: string): string {
  if (tagName.toLowerCase() !== 'a' || tag.startsWith('</')) return tag;
  // Remove any existing target/rel, then append the safe ones.
  const stripped = tag
    .replace(/\s(target|rel)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/>$/, ' target="_blank" rel="noopener noreferrer">');
  return stripped;
}
