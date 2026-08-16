const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export function requireConfigObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Configuration '${path}' must be an object.`);
  }
  return value;
}

export function requireConfigString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Configuration '${path}' must be a non-empty string.`);
  }
  return value;
}

export function requireConfigRange(value, range, path) {
  if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
    throw new RangeError(
      `Configuration '${path}' must be within [${range[0]}, ${range[1]}].`,
    );
  }
  return value;
}

export function requirePositiveConfig(value, path) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`Configuration '${path}' must be positive.`);
  }
  return value;
}

export function requireConfigInteger(value, range, path) {
  requireConfigRange(value, range, path);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Configuration '${path}' must be an integer.`);
  }
  return value;
}

export function requireConfigPair(value, range, path) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`Configuration '${path}' must contain two numbers.`);
  }
  const minimum = requireConfigRange(value[0], range, `${path}[0]`);
  const maximum = requireConfigRange(value[1], range, `${path}[1]`);
  if (maximum < minimum) {
    throw new RangeError(`Configuration '${path}' must be [minimum, maximum].`);
  }
  return Object.freeze([minimum, maximum]);
}

export function requireConfigIntegerPair(value, range, path) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`Configuration '${path}' must contain two integers.`);
  }
  const minimum = requireConfigInteger(value[0], range, `${path}[0]`);
  const maximum = requireConfigInteger(value[1], range, `${path}[1]`);
  if (maximum < minimum) {
    throw new RangeError(`Configuration '${path}' must be [minimum, maximum].`);
  }
  return Object.freeze([minimum, maximum]);
}

export function requireConfigVector2(value, path) {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(Number.isFinite)
  ) {
    throw new TypeError(`Configuration '${path}' must contain two finite numbers.`);
  }
  return Object.freeze([...value]);
}

export function requireConfigColor(value, path) {
  requireConfigString(value, path);
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new TypeError(`Configuration '${path}' must be a #RRGGBB color.`);
  }
  return value;
}

export function requireConfigPalette(value, path, minimumLength = 2) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new TypeError(
      `Configuration '${path}' must contain at least ${minimumLength} colors.`,
    );
  }
  value.forEach((color, index) =>
    requireConfigColor(color, `${path}[${index}]`),
  );
  return Object.freeze([...value]);
}
