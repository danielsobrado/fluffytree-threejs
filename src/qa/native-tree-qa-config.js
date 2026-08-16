function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`Configuration '${path}' must be a positive integer.`);
  }
  return value;
}

function requireUnsignedInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) {
    throw new RangeError(
      `Configuration '${path}' must be an unsigned 32-bit integer.`,
    );
  }
  return value;
}

function requirePositive(value, path) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Configuration '${path}' must be positive.`);
  }
  return value;
}

export function parseNativeTreeQaConfig(config) {
  const source = config?.nativeTreeQa;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('nativeTreeQa must be an object.');
  }
  return Object.freeze({
    seedsPerPreset: requirePositiveInteger(
      source.seedsPerPreset,
      'nativeTreeQa.seedsPerPreset',
    ),
    baseSeed: requireUnsignedInteger(source.baseSeed, 'nativeTreeQa.baseSeed'),
    maximumStemCount: requirePositiveInteger(
      source.maximumStemCount,
      'nativeTreeQa.maximumStemCount',
    ),
    maximumFoliageSiteCount: requirePositiveInteger(
      source.maximumFoliageSiteCount,
      'nativeTreeQa.maximumFoliageSiteCount',
    ),
    maximumHorizontalSpanRatio: requirePositive(
      source.maximumHorizontalSpanRatio,
      'nativeTreeQa.maximumHorizontalSpanRatio',
    ),
    maximumVerticalSpanRatio: requirePositive(
      source.maximumVerticalSpanRatio,
      'nativeTreeQa.maximumVerticalSpanRatio',
    ),
    minimumBoundsExtent: requirePositive(
      source.minimumBoundsExtent,
      'nativeTreeQa.minimumBoundsExtent',
    ),
  });
}
