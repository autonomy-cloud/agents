#!/bin/bash
# Boots the whole local coworker dev stack with one command:
#   1. builds (if needed) and starts openagents-server natively, --dev mode
#   2. starts openagents-coworker natively via `uv run`, if
#      OPENAGENTS_OPENAI_BASE_URL is set (skipped with a clear message if not —
#      it's intentionally unconfigured until a real internal endpoint exists)
#   3. starts the openagents-workstation container via docker compose
#
# openagents-console is not started here — run it separately with
# `next dev` (see runtime/components/openagents-console/README.md) so it
# stays fast to iterate on. It already defaults to ws://127.0.0.1:7880 /
# devkey / secret, matching what this script brings up.
#
# Ctrl+C stops everything this script started.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVER_DIR="$REPO_ROOT/runtime/components/openagents-server"
SERVER_BIN="$SERVER_DIR/build/openagents-server"
COWORKER_DIR="$REPO_ROOT/runtime/components/openagents-coworker"

OPENAGENTS_URL="${OPENAGENTS_URL:-ws://127.0.0.1:7880}"
OPENAGENTS_API_KEY="${OPENAGENTS_API_KEY:-devkey}"
OPENAGENTS_API_SECRET="${OPENAGENTS_API_SECRET:-secret}"
export OPENAGENTS_URL OPENAGENTS_API_KEY OPENAGENTS_API_SECRET

PIDS=()
cleanup() {
  echo
  echo "Stopping dev stack..."
  for pid in "${PIDS[@]:-}"; do
    kill "$pid" 2>/dev/null || true
  done
  (cd "$REPO_ROOT" && docker compose down) 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> openagents-server"
if [ ! -x "$SERVER_BIN" ]; then
  echo "    building (first run only)..."
  # NOTE: this component's vendor/ tree is currently missing several
  # transitive packages (a pre-existing gap, not introduced here), so
  # -mod=vendor fails; -mod=mod (network-resolved) is what actually works
  # today. Switch back to -mod=vendor once vendor/ is regenerated/fixed.
  (cd "$SERVER_DIR" && GOFLAGS=-mod=mod go build -o build/openagents-server ./cmd/server)
fi
"$SERVER_BIN" --dev --node-ip=127.0.0.1 &
SERVER_PID=$!
PIDS+=("$SERVER_PID")

echo "    waiting for http://127.0.0.1:7880 ..."
for _ in $(seq 1 30); do
  if curl -s -o /dev/null "http://127.0.0.1:7880/"; then
    echo "    up (pid $SERVER_PID)"
    break
  fi
  sleep 0.5
done

echo "==> openagents-coworker"
if [ -n "${OPENAGENTS_OPENAI_BASE_URL:-}" ]; then
  (cd "$COWORKER_DIR" && uv run --package openagents-coworker openagents-coworker dev) &
  PIDS+=("$!")
  echo "    starting (pid ${PIDS[-1]})"
else
  echo "    skipped: OPENAGENTS_OPENAI_BASE_URL is not set."
  echo "    (see runtime/components/openagents-coworker/README.md — this is"
  echo "     expected until a real internal OpenAI-compatible endpoint exists)"
fi

echo "==> openagents-workstation (docker compose)"
# The workstation container needs host.docker.internal, not 127.0.0.1 (that
# would be the container's own loopback) — override explicitly here rather
# than relying on the compose file's own default, since the OPENAGENTS_URL
# exported above (for the native server/coworker processes) would otherwise
# shadow it.
(cd "$REPO_ROOT" && OPENAGENTS_URL="ws://host.docker.internal:7880" docker compose up --build)
