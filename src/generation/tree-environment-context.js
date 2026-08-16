function vector(value, fallback, path) {
  const source = value ?? fallback;
  const values = Array.isArray(source)
    ? source
    : [source?.x, source?.y, source?.z];
  if (values.length !== 3 || !values.every(Number.isFinite)) {
    throw new TypeError(`${path} must contain three finite numbers.`);
  }
  const length = Math.hypot(values[0], values[1], values[2]);
  if (length <= Number.EPSILON) {
    throw new RangeError(`${path} must not be a zero vector.`);
  }
  return Object.freeze({
    x: values[0] / length,
    y: values[1] / length,
    z: values[2] / length,
  });
}

function unit(value, fallback, path) {
  const candidate = value ?? fallback;
  if (!Number.isFinite(candidate) || candidate < 0 || candidate > 1) {
    throw new RangeError(`${path} must be within [0, 1].`);
  }
  return candidate;
}

function volume(value, index, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${path}[${index}] must be an object.`);
  }
  const centerValues = Array.isArray(value.center)
    ? value.center
    : [value.center?.x, value.center?.y, value.center?.z];
  if (centerValues.length !== 3 || !centerValues.every(Number.isFinite)) {
    throw new TypeError(`${path}[${index}].center must contain three finite numbers.`);
  }
  if (!Number.isFinite(value.radius) || value.radius <= 0) {
    throw new RangeError(`${path}[${index}].radius must be positive.`);
  }
  return Object.freeze({
    center: Object.freeze({
      x: centerValues[0],
      y: centerValues[1],
      z: centerValues[2],
    }),
    radius: value.radius,
    strength: unit(value.strength, 1, `${path}[${index}].strength`),
  });
}

function volumes(value, path) {
  if (value === undefined) return Object.freeze([]);
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array.`);
  return Object.freeze(value.map((entry, index) => volume(entry, index, path)));
}

export function createTreeEnvironmentContext(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Tree environment context must be an object.');
  }
  return Object.freeze({
    groundNormal: vector(value.groundNormal, [0, 1, 0], 'environment.groundNormal'),
    lightDirection: vector(
      value.lightDirection,
      [0, 1, 0],
      'environment.lightDirection',
    ),
    lightBias: unit(value.lightBias, 0, 'environment.lightBias'),
    prevailingWindDirection: vector(
      value.prevailingWindDirection,
      [1, 0, 0],
      'environment.prevailingWindDirection',
    ),
    windStrength: unit(value.windStrength, 0, 'environment.windStrength'),
    competitionVolumes: volumes(
      value.competitionVolumes,
      'environment.competitionVolumes',
    ),
    pruningVolumes: volumes(value.pruningVolumes, 'environment.pruningVolumes'),
  });
}
