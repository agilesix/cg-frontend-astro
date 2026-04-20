import { Client, Auth } from '@common-grants/sdk/client';
import grantsGovPlugin from '@common-grants/cg-grants-gov';
import { ZodError } from 'zod';
import { PaOpportunitySchema } from './adapters/pa';
import type { Source, SourceId } from './federation/source';

/**
 * Build the configured Source list from environment variables. Works from
 * both server (SSR middleware) and client (Svelte islands) contexts — the env
 * vars use the PUBLIC_ prefix so Astro inlines them into the client bundle.
 *
 * Sources contain a live SDK Client instance which isn't JSON-serializable,
 * so we can't pass Source[] as an island prop from SSR; each context calls
 * this function directly. Browser calls require CORS to be enabled on each
 * upstream API.
 */
export function createSources(): Source[] {
  const paUrl = import.meta.env.PUBLIC_PA_API_URL;
  const fedUrl = import.meta.env.PUBLIC_FEDERAL_API_URL;
  const sources: Source[] = [];

  if (paUrl) {
    sources.push({
      id: 'pa',
      label: 'Pennsylvania',
      client: new Client({ baseUrl: paUrl, auth: Auth.none() }),
      schema: PaOpportunitySchema,
      enabled: true,
    });
  }

  if (fedUrl) {
    // api.simpler.grants.gov expects the token in `X-API-Key` (confirmed by
    // probing their endpoint). `Auth.apiKey()` uses that header by default.
    // If the token is missing, fall back to `none()` and let the 401 get
    // silently swallowed by searchAll().
    const fedToken = import.meta.env.PUBLIC_FEDERAL_API_TOKEN;
    const fedAuth = fedToken ? Auth.apiKey(fedToken) : Auth.none();
    sources.push({
      id: 'federal',
      label: 'Federal (Grants.gov)',
      client: new Client({ baseUrl: fedUrl, auth: fedAuth }),
      schema: grantsGovPlugin.schemas.Opportunity,
      enabled: true,
    });
  }

  return sources;
}

/**
 * Detail-page helper: routes to the source that owns this id.
 *
 * Primary path is the SDK's `.opportunities.get()` — it parses the envelope,
 * validates with the source's custom-field schema, and returns typed data.
 *
 * Fallback path catches `ZodError` (e.g. Federal's `attachments[].createdAt`
 * doesn't always satisfy strict ISO 8601). We refetch the raw body and render
 * the unvalidated payload so a single cosmetic schema miss doesn't blank the
 * whole page — the UI reads fields via `getByPath()` which tolerates gaps.
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

    // Schema validation miss — re-fetch raw and render what we got.
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

export function getSourceDescriptors(): SourceDescriptor[] {
  return createSources().map((s) => ({ id: s.id, label: s.label }));
}
