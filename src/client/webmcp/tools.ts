import { tick } from 'svelte';
import type { SourceId } from '@/client/federation/source';
import type { ActiveFilters } from '@/client/types';
import {
  activeTab,
  query,
  filters,
  sortBy,
  sortOrder,
  getPage,
  setPage,
  pageSize,
  urlParams,
} from '@/stores/searchStore';
import { sourceState, visibleItems, totalPagesCount, total } from '@/stores/resultsStore';
import { createContracts } from './contracts';
import type { SiteTool } from './register';

export function createSiteTools(
  sources: Array<{ id: SourceId; label: string }>,
  refresh: () => Promise<void>,
): SiteTool[] {
  const contracts = createContracts(sources.map((s) => s.id));
  const empty = { type: 'object', properties: {}, additionalProperties: false };
  let busy = false;
  function state() {
    const states = sourceState.get();
    const active = states[activeTab.get()];
    return {
      source: activeTab.get(),
      query: query.get(),
      filters: filters.get(),
      sort: `${sortBy.get()}:${sortOrder.get()}`,
      page: getPage(),
      pageSize: pageSize.get(),
      total: active.loading || active.error ? null : total.get(),
      totalPages: active.loading || active.error ? null : totalPagesCount.get(),
      loading: active.loading,
      error: active.error,
      opportunities: active.loading || active.error ? [] : visibleItems.get(),
      sources: sources.map(({ id, label }) => ({
        id,
        label,
        loading: states[id].loading,
        error: states[id].error,
        total: states[id].loading || states[id].error ? null : states[id].total,
      })),
      url: window.location.href,
      collectionLimitPerSource: 1000,
    };
  }
  function tool(
    name: string,
    description: string,
    inputSchema: Record<string, unknown>,
    readOnlyHint: boolean,
    execute: (input: unknown) => Promise<unknown>,
  ): SiteTool {
    return {
      name,
      description,
      inputSchema,
      annotations: { readOnlyHint },
      execute: async (input) => {
        try {
          return await execute(input);
        } catch (error) {
          return {
            status: 'error',
            error: error instanceof Error ? error.message : 'Request failed',
          };
        }
      },
    };
  }
  function noArgs(input: unknown) {
    if (
      input == null ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length
    )
      throw new Error('Expected an empty object');
  }
  return [
    tool(
      'list_sources',
      'Read configured sources and supported search inputs. Website IDs california/washington correspond to headless MCP ca/wa. No page changes.',
      empty,
      true,
      async (input) => {
        noArgs(input);
        return { sources, searchInput: contracts.searchJson };
      },
    ),
    tool(
      'get_search_state',
      'Read current visible query, filters, source, sort, page and results. Loading or failed sources are not successful empty searches.',
      empty,
      true,
      async (input) => {
        noArgs(input);
        return state();
      },
    ),
    tool(
      'search_opportunities',
      'Update visible website search, filters, sort or page and return its resulting page. Uses the shared grant service, collecting at most 1,000 items per source before local filters and pagination. Omitted inputs preserve current values; supplied filters replace them. Criteria changes default to page 1. Manual changes can supersede this call.',
      contracts.searchJson,
      false,
      async (input) => {
        const args = contracts.search.parse(input);
        if (busy)
          throw new Error(
            'Another site search is in progress; read current state or retry after it finishes.',
          );
        busy = true;
        try {
          if (args.source !== undefined) activeTab.set(args.source as SourceId);
          if (args.query !== undefined) query.set(args.query);
          if (args.filters !== undefined) filters.set(args.filters as ActiveFilters);
          if (args.sort !== undefined) {
            const [field, order] = args.sort.split(':');
            sortBy.set(field!);
            sortOrder.set(order as 'asc' | 'desc');
          }
          if (args.page !== undefined) setPage(args.page);
          else if (
            args.query !== undefined ||
            args.filters !== undefined ||
            args.sort !== undefined
          )
            setPage(1);
          const requested = urlParams.get();
          // Observe criteria transitions, not just final equality: A → B → A
          // is still a newer user search. Page clamping is a normal settlement.
          let superseded = false;
          const unsubs = [query, filters, activeTab, sortBy, sortOrder].map((store) =>
            store.listen(() => {
              superseded = true;
            }),
          );
          try {
            await refresh();
            await tick();
            const current = state();
            const expected = new URLSearchParams(requested);
            const requestedPage = Number(expected.get('page') ?? 1);
            const settledPage = Math.min(requestedPage, current.totalPages ?? requestedPage);
            if (settledPage > 1) expected.set('page', String(settledPage));
            else expected.delete('page');
            return {
              status:
                superseded || expected.toString() !== urlParams.get() || current.loading
                  ? 'superseded'
                  : current.error
                    ? 'error'
                    : 'success',
              ...current,
            };
          } finally {
            unsubs.forEach((unsubscribe) => unsubscribe());
          }
        } finally {
          busy = false;
        }
      },
    ),
    tool(
      'get_opportunity',
      'Read full details through the shared service without navigating or changing visible search. Returns a same-site detail URL. Does not submit applications.',
      contracts.detailJson,
      true,
      async (input) => {
        const args = contracts.detail.parse(input);
        const response = await fetch(
          `/api/sources/${args.source}/opportunities/${encodeURIComponent(args.id)}`,
          { signal: AbortSignal.timeout(20000) },
        );
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'Opportunity not found'
              : `Detail request failed (${response.status})`,
          );
        return {
          source: args.source,
          opportunity: await response.json(),
          url: new URL(
            `/opportunities/${args.source}/${encodeURIComponent(args.id)}`,
            window.location.origin,
          ).href,
        };
      },
    ),
  ];
}
