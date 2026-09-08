# WebMCP staging

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
   state, opportunity details, and shortlist presentation.
4. Validate manual and agent actions against the same visible page state.

Before merging, test search, pagination, empty results, source errors, navigation,
and switching between manual and agent actions on this preview. Also verify the
normal site remains usable in a browser without WebMCP support. Keep source
credentials server-side and use the existing site permissions.

This initial PR establishes the preview baseline. WebMCP tools and shared-service
integration are not implemented yet.
