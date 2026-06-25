#!/usr/bin/env bash
set -euo pipefail

# Delete a per-PR preview Worker for cg-astro.
#
# Usage:
#   ./scripts/preview-cleanup.sh <identifier>
#
# Example:
#   ./scripts/preview-cleanup.sh pr-42
#   ./scripts/preview-cleanup.sh my-feature

IDENTIFIER="${1:?Usage: preview-cleanup.sh <identifier>}"
WORKER_NAME="cg-astro-${IDENTIFIER}"
WRANGLER="pnpm exec wrangler"

echo "→ Deleting preview Worker: ${WORKER_NAME}"
${WRANGLER} delete --name "${WORKER_NAME}" 2>&1 || \
  echo "  Worker not found (already cleaned up)"

echo "  ✓ Cleanup complete"
