import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Same-origin proxy for api.simpler.grants.gov.
 *
 * Reads `FEDERAL_API_TOKEN` from `process.env` at request time:
 *
 *   - In `astro dev`, Astro/Vite populates `process.env` from `.env.local`
 *     when the dev server starts.
 *   - In Cloudflare Workers production, `process.env` is bound at runtime
 *     by the Workers runtime (with `nodejs_compat` enabled). Set the secret
 *     via `wrangler secret put FEDERAL_API_TOKEN` or the Workers dashboard.
 *
 * The token is never inlined into a build artifact — `process.env.X` is a
 * runtime read, not a Vite static replacement (that would be
 * `import.meta.env.X`). The build output contains only `process.env.X`
 * references, which the runtime resolves.
 *
 * Browser islands hit `/api/proxy/federal/...`; this handler injects
 * `X-API-Key` and forwards. The token never reaches the client bundle.
 */

const FEDERAL_ORIGIN_DEFAULT = 'https://api.simpler.grants.gov';

const STRIP_REQUEST_HEADERS = new Set([
  'host',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'proxy-authorization',
  'proxy-authenticate',
  'te',
  'trailer',
  'cf-connecting-ip',
  'cf-ray',
  'cf-visitor',
  'x-forwarded-proto',
  'x-real-ip',
]);

async function handle(
  req: Request,
  params: Record<string, string | undefined>,
): Promise<Response> {
  const base = process.env.FEDERAL_API_URL ?? FEDERAL_ORIGIN_DEFAULT;
  const token = process.env.FEDERAL_API_TOKEN;
  if (!token) {
    return new Response('FEDERAL_API_TOKEN is not configured', { status: 503 });
  }

  const path = params.path ?? '';
  const upstream = new URL(path, base.endsWith('/') ? base : base + '/');
  upstream.search = new URL(req.url).search;

  const fwd = new Headers();
  for (const [k, v] of req.headers.entries()) {
    if (!STRIP_REQUEST_HEADERS.has(k.toLowerCase())) fwd.set(k, v);
  }
  fwd.set('X-API-Key', token);

  const res = await fetch(upstream.toString(), {
    method: req.method,
    headers: fwd,
    body:
      req.method === 'GET' || req.method === 'HEAD'
        ? undefined
        : await req.arrayBuffer().then((b) => (b.byteLength ? b : undefined)),
    redirect: 'follow',
  });

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

export const GET: APIRoute = ({ request, params }) => handle(request, params);
export const POST: APIRoute = ({ request, params }) => handle(request, params);
export const PUT: APIRoute = ({ request, params }) => handle(request, params);
export const DELETE: APIRoute = ({ request, params }) => handle(request, params);
