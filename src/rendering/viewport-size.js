const MINIMUM_VIEWPORT_SIZE = 1;

function normalizeDimension(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return MINIMUM_VIEWPORT_SIZE;
  return Math.max(MINIMUM_VIEWPORT_SIZE, Math.floor(number));
}

export function measureViewport(container) {
  return Object.freeze({
    width: normalizeDimension(container?.clientWidth),
    height: normalizeDimension(container?.clientHeight),
  });
}
