function requireInteger(value, minimum, maximum, path) {
  if (
    !Number.isSafeInteger(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(`${path} must be an integer within [${minimum}, ${maximum}].`);
  }
  return value;
}

function requireRange(value, minimum, maximum, path) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new RangeError(`${path} must be within [${minimum}, ${maximum}].`);
  }
  return value;
}

function requirePair(value, minimum, maximum, path) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`${path} must contain exactly two numbers.`);
  }
  const low = requireRange(value[0], minimum, maximum, `${path}[0]`);
  const high = requireRange(value[1], minimum, maximum, `${path}[1]`);
  if (high < low) throw new RangeError(`${path} must be [minimum, maximum].`);
  return Object.freeze([low, high]);
}

export function parseForestVariantPolicy(config) {
  const source = config?.variants;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    throw new TypeError('forestVariantPolicy.variants must be an object.');
  }

  return Object.freeze({
    maximumPerSpecies: requireInteger(
      source.maximumPerSpecies,
      1,
      256,
      'forestVariantPolicy.variants.maximumPerSpecies',
    ),
    scaleRange: requirePair(
      source.scaleRange,
      0.5,
      2,
      'forestVariantPolicy.variants.scaleRange',
    ),
    colorOffsetRange: requirePair(
      source.colorOffsetRange,
      -0.5,
      0.5,
      'forestVariantPolicy.variants.colorOffsetRange',
    ),
    windStrengthRange: requirePair(
      source.windStrengthRange,
      0,
      2,
      'forestVariantPolicy.variants.windStrengthRange',
    ),
    rotationJitter: requireRange(
      source.rotationJitter,
      0,
      Math.PI * 2,
      'forestVariantPolicy.variants.rotationJitter',
    ),
  });
}
