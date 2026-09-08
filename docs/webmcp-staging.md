# WebMCP staging

## Shared service integration

The website consumes `@common-grants/grant-service` from the MCP
repository's `src/core` directory, pinned to a full GitHub commit in package.json
and pnpm-lock.yaml. No npm publication or local sibling checkout is required.
Use pnpm 10.33.0 and frozen-lockfile installs in CI. The package exposes TypeScript
source for Vite to bundle on the server; it must not be imported by browser islands.

Search uses the service's bounded collection operation (up to 1,000 items), then
the existing website filters, sorting and pagination. MCP short-page search is
unchanged. Website source IDs and URLs are preserved. SDK parsing may omit invalid
upstream rows; valid opportunities retain custom fields and JSON dates.
The shared service stays server-side. WebMCP is a page adapter, not another
upstream client or an exposed copy of server credentials.

## Site tools on the search page

Registration uses the top-level `document.modelContext.registerTool` API from
the [official OpenAI WebMCP documentation](https://learn.chatgpt.com/docs/webmcp).
It is feature-detected, so unsupported browsers retain normal manual search.

| Tool                   | Effect                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `list_sources`         | Reads configured source IDs and supported search inputs.                                               |
| `get_search_state`     | Reads current filters, query, source, sort, page, loading/error state, and visible results.            |
| `search_opportunities` | Updates the visible search using the same stores, filtering, cache, and pagination as manual controls. |
| `get_opportunity`      | Reads full details through the shared service and returns a same-site detail URL without navigating.   |

Tools are available on `/search`; navigating to a detail page leaves that tool
registration behind. Return to search to use them again. The website retains
`california` and `washington` IDs for existing URLs; the headless MCP equivalents
are `ca` and `wa`.

Omitted search inputs keep current state. Supplying `filters` replaces the whole
filter set; `{}` explicitly removes every filter, including status. Query, filter,
or sort changes start on page 1 unless a page is supplied. Responses describe
the resulting page, not every collected opportunity. Read `get_search_state`
after manual edits rather than assuming a prior tool response is still current.
Source-only switches retain that tab's remembered page. Settled results clamp
out-of-range pages to the available range. Explicitly cleared filters are
preserved on reload with the `filters=none` URL marker.

Shortlist presentation is deferred to a follow-up because the website needs a
dedicated visible shortlist view. This first slice does not submit applications,
register tools inside iframes, or require installation of a separate MCP server.

## Preview workflow

Use a draft PR and its per-PR Cloudflare Worker as the integration environment.
Each push updates the same preview URL. Closing the PR removes its preview.
The production deployment remains tied to main.

The preview workflow publishes the URL in a PR comment and the GitHub preview
environment, then checks that the homepage and server-rendered search page load.
These page checks do not establish working upstream search or WebMCP rendering.

## Staging milestones

1. Establish a working preview of the existing portal.
2. Integrate the extracted shared grant service on the server, with explicit
   source-ID mapping and compatible SDK dependencies.
3. Add top-level WebMCP registration for source discovery, search, current search
   state, and opportunity details.
4. Validate manual and agent actions against the same visible page state.

Before merging, test search, pagination, empty results, source errors, navigation,
and switching between manual and agent actions on this preview. Also verify the
normal site remains usable in a browser without WebMCP support. Keep source
credentials server-side and use the existing site permissions.

5. Add shortlist presentation after its website view has been designed and tested.

## Verification checklist

- Run type, lint, format, unit-test, audit, and build checks.
- Use the actual Cloudflare URL from the PR deployment comment.
- Discover the four tools through a real supporting host, not a mocked API.
- Execute search and compare the returned IDs, source, filters, and page with
  the rendered interface. Check source switching, sorting, and page 2.
- Mix manual input with tool calls and confirm both read the same current state.
- Verify an empty query result, invalid input, source failure, and details.
- Verify ordinary search in a browser without WebMCP. Simulated registration
  tests alone do not prove host support or rendered behavior.
- Record the tested commit and any unverified cases in the PR before merging.
