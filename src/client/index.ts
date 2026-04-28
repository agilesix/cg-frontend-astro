import { Client, Auth } from '@common-grants/sdk/client';
import grantsGovPlugin from '@common-grants/cg-grants-gov';
import { ZodError } from 'zod';
import { PaOpportunitySchema } from './adapters/pa';
import type { Source, SourceId } from './federation/source';

/**
 * Build the configured Source list.
 *
 * Two factories because the federal token must stay server-side:
 *
 *   - `createBrowserSources()` (Svelte islands): federal calls go through
 *     `/api/proxy/federal/*`, our same-origin Astro endpoint that injects
 *     `X-API-Key` server-side. The browser bundle never sees the token.
 *   - `createServerSources()` (middleware, SSR pages): federal calls go
 *     direct to the upstream API with `Auth.apiKey(FEDERAL_API_TOKEN)`.
 *     `import.meta.env.FEDERAL_API_TOKEN` reads from `.env.local` for SSR
 *     code without inlining into the client bundle (only `PUBLIC_*` is
 *     inlined client-side).
 *
 * PA is the same in both contexts — open API with CORS, no secrets, baseUrl
 * inlined via `PUBLIC_PA_API_URL`.
 */

function paClient(): Source | null {
  const url = import.meta.env.PUBLIC_PA_API_URL;
  if (!url) return null;
  return {
    id: 'pa',
    label: 'Pennsylvania',
    client: new Client({ baseUrl: url, auth: Auth.none() }),
    schema: PaOpportunitySchema,
    enabled: true,
  };
}

export function createBrowserSources(): Source[] {
  const sources: Source[] = [];
  const pa = paClient();
  if (pa) sources.push(pa);

  // Federal is only added when running in the browser, where we have a real
  // origin to build the proxy URL from. The SDK's `Client` constructor calls
  // `new URL(baseUrl)` and throws on relative URLs — so passing
  // `/api/proxy/federal` during SSR (window undefined) blows up the entire
  // page render. Islands re-evaluate this function on hydration; at that
  // point window exists and federal joins the source list.
  const federalConfigured = import.meta.env.PUBLIC_FEDERAL_API_URL;
  if (federalConfigured && typeof window !== 'undefined') {
    sources.push({
      id: 'federal',
      label: 'Federal (Grants.gov)',
      client: new Client({
        baseUrl: `${window.location.origin}/api/proxy/federal`,
        auth: Auth.none(),
      }),
      schema: grantsGovPlugin.schemas.Opportunity,
      enabled: true,
    });
  }
  return sources;
}

export function createServerSources(): Source[] {
  const sources: Source[] = [];
  const pa = paClient();
  if (pa) sources.push(pa);

  // Read from `process.env` so the token is resolved at runtime, not baked
  // into the build (which `import.meta.env` would do). Falls back to the
  // public URL if no server-only override is set.
  const federalUrl = process.env.FEDERAL_API_URL ?? import.meta.env.PUBLIC_FEDERAL_API_URL;
  if (federalUrl) {
    const token = process.env.FEDERAL_API_TOKEN;
    sources.push({
      id: 'federal',
      label: 'Federal (Grants.gov)',
      client: new Client({
        baseUrl: federalUrl,
        auth: token ? Auth.apiKey(token) : Auth.none(),
      }),
      schema: grantsGovPlugin.schemas.Opportunity,
      enabled: true,
    });
  }
  return sources;
}

/**
 * Detail-page helper: routes to the source that owns this id.
 *
 * Primary path uses the SDK's `.opportunities.get()` — typed + envelope-
 * validated. Falls back to a raw fetch + raw payload on `ZodError` so
 * cosmetic schema nits (e.g. federal's `attachments[].createdAt` uses
 * `+00:00` offset which Zod's default strict `.datetime()` rejects) don't
 * blank the whole detail page.
 */
export async function getOpportunity(
  sources: Source[],
  sourceId: SourceId,
  id: string,
): Promise<unknown | null> {
  const src = sources.find((s) => s.id === sourceId);
  if (!src) throw new Error(`Unknown source: ${sourceId}`);

  try {
    return await src.client.opportunities.get(id, { schema: src.schema });
  } catch (err) {
    if (!(err instanceof ZodError)) throw err;
    const res = await src.client.fetch(`/common-grants/opportunities/${encodeURIComponent(id)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw err;
    const body: unknown = await res.json();
    const raw =
      body && typeof body === 'object' && 'data' in body
        ? (body as { data: unknown }).data
        : body;
    console.warn(
      `[${src.label}] opportunity ${id} failed strict schema validation; rendering raw payload`,
      err.issues,
    );
    return raw;
  }
}

// Serializable subset — safe to pass as an island prop (no Client instance).
export interface SourceDescriptor {
  id: SourceId;
  label: string;
}

/**
 * Build the descriptor list for SSR pages to pass into islands. Uses
 * server-side env so this works without runtime bindings; descriptors only
 * include `{id, label}`, no secrets or URLs.
 */
export function getSourceDescriptors(): SourceDescriptor[] {
  const out: SourceDescriptor[] = [];
  if (import.meta.env.PUBLIC_PA_API_URL) out.push({ id: 'pa', label: 'Pennsylvania' });
  const federalConfigured = process.env.FEDERAL_API_URL ?? import.meta.env.PUBLIC_FEDERAL_API_URL;
  if (federalConfigured) out.push({ id: 'federal', label: 'Federal (Grants.gov)' });
  return out;
}
