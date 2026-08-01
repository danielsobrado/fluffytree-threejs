#!/usr/bin/env bash
set -euo pipefail

readonly PORT="${RENDER_SMOKE_PORT:-4173}"
readonly OUTPUT_DIR="${RENDER_SMOKE_OUTPUT:-qa-results/render-smoke}"
readonly URL="http://127.0.0.1:${PORT}/?qa=render-smoke"

mkdir -p "${OUTPUT_DIR}"

SERVER_LOG="${OUTPUT_DIR}/server.log"

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

capture() {
  local name="$1"
  local size="$2"
  local dom_output="${OUTPUT_DIR}/${name}.html"
  local screenshot_output="${OUTPUT_DIR}/${name}.png"

  "${CHROME_BIN}" \
    --headless=new \
    --no-sandbox \
    --disable-dev-shm-usage \
    --enable-webgl \
    --ignore-gpu-blocklist \
    --enable-unsafe-swiftshader \
    --use-gl=angle \
    --use-angle=swiftshader \
    --force-device-scale-factor=1 \
    --window-size="${size}" \
    --virtual-time-budget=40000 \
    --screenshot="${screenshot_output}" \
    --dump-dom \
    "${URL}" >"${dom_output}"

  if ! grep --quiet 'data-render-status="ready"' "${dom_output}"; then
    echo "${name} render smoke test did not reach the ready state." >&2
    grep --only-matching 'data-render-status="[^"]*"' "${dom_output}" >&2 || true
    grep --only-matching 'data-render-error="[^"]*"' "${dom_output}" >&2 || true
    exit 1
  fi
}

capture desktop 1440,900
capture mobile 720,1440

echo "Render smoke tests passed: ${OUTPUT_DIR}/desktop.png and ${OUTPUT_DIR}/mobile.png"
