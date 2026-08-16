function requirePositive(value, path) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${path} must be a positive finite number.`);
  }
  return value;
}

export function parseForestRuntimePolicy(config) {
  const source = config?.runtime;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('forestRuntimePolicy.runtime must be an object.');
  }
  const chunkSize = requirePositive(
    source.chunkSize,
    'forestRuntimePolicy.runtime.chunkSize',
  );
  const visibilityRadius = requirePositive(
    source.visibilityRadius,
    'forestRuntimePolicy.runtime.visibilityRadius',
  );
  if (visibilityRadius < chunkSize) {
    throw new RangeError(
      'forestRuntimePolicy.runtime.visibilityRadius must be at least chunkSize.',
    );
  }
  return Object.freeze({ chunkSize, visibilityRadius });
}
