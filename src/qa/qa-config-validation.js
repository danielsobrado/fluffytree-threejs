const MAXIMUM_UINT32 = 0xffffffff;

export function requireQaObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Configuration '${path}' must be an object.`);
  }
  return value;
}

export function requireQaFinite(
  value,
  path,
  { minimum = Number.NEGATIVE_INFINITY, maximum = Number.POSITIVE_INFINITY } = {},
) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Configuration '${path}' must be a finite number within [${minimum}, ${maximum}].`,
    );
  }
  return value;
}

export function requireQaInteger(
  value,
  path,
  { minimum = Number.MIN_SAFE_INTEGER, maximum = Number.MAX_SAFE_INTEGER } = {},
) {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new Error(
      `Configuration '${path}' must be an integer within [${minimum}, ${maximum}].`,
    );
  }
  return value;
}

export function requireQaUint32(value, path) {
  return requireQaInteger(value, path, {
    minimum: 0,
    maximum: MAXIMUM_UINT32,
  });
}

export function assertQaSeedRange(seedStart, seedCount, path) {
  if (seedCount > MAXIMUM_UINT32 - seedStart + 1) {
    throw new Error(
      `Configuration '${path}' seed range must stay within unsigned 32-bit values.`,
    );
  }
}

export function requireQaRange(value, path) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Configuration '${path}' must contain exactly two numbers.`);
  }

  const minimum = requireQaFinite(value[0], `${path}[0]`);
  const maximum = requireQaFinite(value[1], `${path}[1]`);
  if (maximum < minimum) {
    throw new Error(`Configuration '${path}' maximum must be >= minimum.`);
  }
  return Object.freeze([minimum, maximum]);
}

function requireMetricEntries(value, path) {
  const source = requireQaObject(value, path);
  const entries = Object.entries(source);
  if (entries.length === 0) {
    throw new Error(`Configuration '${path}' must not be empty.`);
  }
  return entries;
}

export function parseQaExactMap(value, path) {
  return Object.freeze(
    Object.fromEntries(
      requireMetricEntries(value, path).map(([metric, expected]) => [
        metric,
        requireQaFinite(expected, `${path}.${metric}`),
      ]),
    ),
  );
}

export function parseQaRangeMap(value, path) {
  return Object.freeze(
    Object.fromEntries(
      requireMetricEntries(value, path).map(([metric, range]) => [
        metric,
        requireQaRange(range, `${path}.${metric}`),
      ]),
    ),
  );
}

export function requireQaStringArray(value, path, { allowEmpty = false } = {}) {
  if (
    !Array.isArray(value) ||
    (!allowEmpty && value.length === 0) ||
    value.some((item) => typeof item !== 'string' || item.trim() === '')
  ) {
    throw new Error(`Configuration '${path}' must contain non-empty strings.`);
  }

  const normalized = value.map((item) => item.trim());
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`Configuration '${path}' must not contain duplicate values.`);
  }
  return Object.freeze(normalized);
}
