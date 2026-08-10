const DEFAULT_RENDER_SMOKE_PORT = 4173;
const RENDER_SMOKE_MODES = new Set([
  'render-smoke',
  'stress',
  'solidity',
  'manifold',
]);

export function parseRenderSmokePort(value = DEFAULT_RENDER_SMOKE_PORT) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('RENDER_SMOKE_PORT must be an integer within [1, 65535].');
  }
  return port;
}

export function parseRenderSmokeMode(value = 'render-smoke') {
  const mode = String(value).trim();
  if (!RENDER_SMOKE_MODES.has(mode)) {
    throw new Error(
      `RENDER_SMOKE_QA_MODE must be one of ${[...RENDER_SMOKE_MODES].join(', ')}.`,
    );
  }
  return mode;
}
