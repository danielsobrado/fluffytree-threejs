#!/usr/bin/env bash
set -euo pipefail

readonly PORT="${RENDER_SMOKE_PORT:-4173}"
readonly OUTPUT_DIR="${RENDER_SMOKE_OUTPUT:-qa-results/render-smoke}"
readonly URL="http://127.0.0.1:${PORT}/?qa=render-smoke"

mkdir -p "${OUTPUT_DIR}"

SERVER_LOG="${OUTPUT_DIR}/server.log"
DOM_OUTPUT="${OUTPUT_DIR}/dom.html"
SCREENSHOT_OUTPUT="${OUTPUT_DIR}/screenshot.png"

python3 -m http.server "${PORT}" --bind 127.0.0.1 >"${SERVER_LOG}" 2>&1 &
SERVER_PID=$!
trap 'kill "${SERVER_PID}" >/dev/null 2>&1 || true' EXIT

for _ in $(seq 1 40); do
  if curl --silent --fail "http://127.0.0.1:${PORT}/" >/dev/null; then
    break
  fi
  sleep 0.25
done

CHROME_BIN="${CHROME_BIN:-}"
if [[ -z "${CHROME_BIN}" ]]; then
  CHROME_BIN="$(command -v google-chrome || command -v chromium || command -v chromium-browser || true)"
fi

if [[ -z "${CHROME_BIN}" ]]; then
  echo "No supported Chrome or Chromium executable was found." >&2
  exit 1
fi

"${CHROME_BIN}" \
  --headless=new \
  --no-sandbox \
  --disable-dev-shm-usage \
  --enable-webgl \
  --ignore-gpu-blocklist \
  --enable-unsafe-swiftshader \
  --use-gl=angle \
  --use-angle=swiftshader \
  --window-size=1440,900 \
  --virtual-time-budget=20000 \
  --screenshot="${SCREENSHOT_OUTPUT}" \
  --dump-dom \
  "${URL}" >"${DOM_OUTPUT}"

if ! grep --quiet 'data-render-status="ready"' "${DOM_OUTPUT}"; then
  echo "Render smoke test did not reach the ready state." >&2
  grep --only-matching 'data-render-status="[^"]*"' "${DOM_OUTPUT}" >&2 || true
  grep --only-matching 'data-render-error="[^"]*"' "${DOM_OUTPUT}" >&2 || true
  exit 1
fi

echo "Render smoke test passed: ${SCREENSHOT_OUTPUT}"
