#!/usr/bin/env bash
set -euo pipefail

# Deploy a per-PR preview Worker for cg-astro. Each identifier gets its own
# Worker name (e.g. `cg-astro-pr-42`), so multiple PRs can be open
# simultaneously without overwriting each other.
#
# Usage:
#   ./scripts/preview-create.sh <identifier>
#
# Example:
#   ./scripts/preview-create.sh pr-42       # CI uses the PR number
#   ./scripts/preview-create.sh my-feature  # local testing
#
# Expected env (optional — passed through to the Worker if set):
#   FEDERAL_API_TOKEN  server-only Worker secret
#
# Expected pre-state:
#   - `pnpm install --frozen-lockfile` has run
#   - `pnpm run build` has run with PUBLIC_* baked into the client bundle
#
# Outputs (for CI consumption via $GITHUB_OUTPUT):
#   worker_name=cg-astro-<identifier>
#   url=https://<worker-name>.<subdomain>.workers.dev

IDENTIFIER="${1:?Usage: preview-create.sh <identifier>}"
WORKER_NAME="cg-astro-${IDENTIFIER}"
WRANGLER="pnpm exec wrangler"
CONFIG="dist/server/wrangler.json"

if [ ! -f "$CONFIG" ]; then
  echo "✗ ${CONFIG} not found — did you run \`pnpm run build\` first?" >&2
  exit 1
fi

# -------------------------------------------------------------------------
# 1. Deploy with a unique Worker name so multiple PRs don't collide
# -------------------------------------------------------------------------

echo "→ Deploying preview Worker: ${WORKER_NAME}"
DEPLOY_OUTPUT=$(${WRANGLER} deploy --config "${CONFIG}" --name "${WORKER_NAME}" 2>&1)
echo "$DEPLOY_OUTPUT"

# Parse the URL from wrangler deploy output (typically the last https:// URL).
PREVIEW_URL=$(echo "$DEPLOY_OUTPUT" | grep -oE 'https://[^ ]+\.workers\.dev' | tail -1)
echo "  ✓ Deployed: ${PREVIEW_URL:-unknown}"

# -------------------------------------------------------------------------
# 2. Apply server-only secrets to this Worker (idempotent)
# -------------------------------------------------------------------------

if [ -n "${FEDERAL_API_TOKEN:-}" ]; then
  echo "→ Setting FEDERAL_API_TOKEN on ${WORKER_NAME}"
  echo "${FEDERAL_API_TOKEN}" \
    | ${WRANGLER} secret put FEDERAL_API_TOKEN --name "${WORKER_NAME}"
fi

# -------------------------------------------------------------------------
# 3. Emit outputs for CI
# -------------------------------------------------------------------------

if [ -n "${GITHUB_OUTPUT:-}" ]; then
  echo "worker_name=${WORKER_NAME}" >> "$GITHUB_OUTPUT"
  echo "url=${PREVIEW_URL}" >> "$GITHUB_OUTPUT"
fi

echo ""
echo "✅ Preview ready: ${PREVIEW_URL:-${WORKER_NAME}}"
