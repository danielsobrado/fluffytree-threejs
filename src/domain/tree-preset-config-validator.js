const REQUIRED_NUMBER_PATHS = Object.freeze([
  'height',
  'crown.baseHeight',
  'crown.height',
  'crown.radius',
  'crown.radialBias',
  'crown.asymmetry',
  'crown.surfaceTension',
  'crown.lobeScaleMultiplier',
  'crown.scaleVariation',
  'crown.clumps.separation',
  'crown.clumps.anchoring',
  'crown.clumps.silhouetteBreakup',
  'trunk.baseRadius',
  'trunk.topRadius',
  'trunk.bend',
  'trunk.flare',
  'trunk.branching.lengthDecay',
  'trunk.branching.radiusDecay',
  'trunk.branching.upwardBias',
  'trunk.branching.gnarl',
  'trunk.branching.twist',
  'trunk.branching.exposedTipRatio',
  'foliage.variation',
  'foliage.paletteBase',
  'foliage.heightPaletteShift',
  'foliage.exposurePaletteShift',
  'foliage.radialNormalStrength',
  'foliage.crownNormalBlend',
  'foliage.wrapLight',
  'foliage.skyLightStrength',
  'foliage.cavityStrength',
  'foliage.heightLightStrength',
  'foliage.volume.smoothing',
  'foliage.volume.padding',
  'foliage.volume.noiseAmplitude',
  'foliage.volume.noiseFrequency',
  'foliage.volume.normalEpsilon',
  'foliage.volume.colorPatchScale',
  'foliage.volume.colorPatchStrength',
  'foliage.core.scale',
  'foliage.core.brightness',
  'foliage.heroLeaves.density',
  'foliage.heroLeaves.scale',
  'foliage.heroLeaves.embedRatio',
  'foliage.heroLeaves.protrusionRatio',
  'foliage.heroLeaves.colorLift',
  'foliage.heroLeaves.colorJitter',
  'foliage.heroLeaves.roughness',
  'foliage.heroLeaves.layerOffsetRatio',
  'foliage.shell.coverageCardRatio',
  'foliage.shell.radialOffsetRatio',
  'foliage.shell.exposureThreshold',
  'foliage.shell.colorJitter',
  'foliage.shell.paletteLift',
  'foliage.shell.cavityScale',
  'foliage.shell.normalBlend',
  'foliage.shell.alphaTest',
  'foliage.shell.shadowProxyScale',
]);

const OPTIONAL_NUMBER_PATHS = Object.freeze([
  'trunk.movement',
  'trunk.curveCount',
  'trunk.sweep',
  'trunk.taperPower',
  'trunk.nebari',
]);

const POSITIVE_NUMBER_PATHS = Object.freeze([
  'height',
  'crown.height',
  'crown.radius',
  'trunk.baseRadius',
  'trunk.topRadius',
]);

const NON_NEGATIVE_NUMBER_PATHS = Object.freeze([
  'crown.baseHeight',
  'trunk.bend',
]);

const UNIT_INTERVAL_PATHS = Object.freeze([
  'crown.radialBias',
  'crown.asymmetry',
]);

const INTEGER_RULES = Object.freeze([
  Object.freeze({ path: 'crown.lobeCount', minimum: 1 }),
  Object.freeze({ path: 'crown.clumps.macroCount', minimum: 1 }),
  Object.freeze({ path: 'trunk.segments', minimum: 2 }),
  Object.freeze({ path: 'trunk.branchCount', minimum: 0 }),
  Object.freeze({ path: 'trunk.branching.depth', minimum: 1 }),
  Object.freeze({ path: 'trunk.branching.primaryCount', minimum: 1 }),
  Object.freeze({ path: 'foliage.volume.resolution', minimum: 1 }),
  Object.freeze({ path: 'foliage.heroLeaves.leavesPerCluster', minimum: 1 }),
  Object.freeze({ path: 'foliage.heroLeaves.layerCount', minimum: 1 }),
  Object.freeze({ path: 'foliage.shell.candidatesPerLobe', minimum: 1 }),
  Object.freeze({ path: 'foliage.shell.planesPerCluster', minimum: 1 }),
]);

const PAIR_RULES = Object.freeze([
  Object.freeze({ path: 'crown.lobeScale', positive: true }),
  Object.freeze({ path: 'crown.verticalScale', positive: true }),
  Object.freeze({ path: 'crown.lean' }),
  Object.freeze({ path: 'crown.clumps.subClumpCount', positive: true, integer: true }),
  Object.freeze({ path: 'trunk.branching.childCount', positive: true, integer: true }),
  Object.freeze({ path: 'foliage.shell.sizeRatio', positive: true }),
  Object.freeze({ path: 'foliage.shell.widthRatio', positive: true }),
  Object.freeze({ path: 'foliage.shell.outwardRatio', positive: true }),
]);

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readPath(source, path) {
  return path
    .split('.')
    .reduce((value, key) => (value === undefined ? undefined : value?.[key]), source);
}

function configurationPath(id, path) {
  return `${id}.${path}`;
}

function requireFiniteNumber(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Configuration '${path}' must be a finite number.`);
  }
  return value;
}

function requireNonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Configuration '${path}' must be a non-empty string.`);
  }
}

function requireInteger(value, path, minimum) {
  requireFiniteNumber(value, path);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`Configuration '${path}' must be an integer >= ${minimum}.`);
  }
}

function requirePair(value, path, { positive = false, integer = false } = {}) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Configuration '${path}' must contain exactly two numbers.`);
  }

  for (const item of value) {
    requireFiniteNumber(item, path);
    if (positive && item <= 0) {
      throw new Error(`Configuration '${path}' must contain positive numbers.`);
    }
    if (integer && !Number.isInteger(item)) {
      throw new Error(`Configuration '${path}' must contain integers.`);
    }
  }

  if (positive && value[1] < value[0]) {
    throw new Error(`Configuration '${path}' must be [minimum, maximum].`);
  }
}

function validateNumericTypes(id, value) {
  for (const path of REQUIRED_NUMBER_PATHS) {
    requireFiniteNumber(readPath(value, path), configurationPath(id, path));
  }

  for (const path of OPTIONAL_NUMBER_PATHS) {
    const candidate = readPath(value, path);
    if (candidate !== undefined) {
      requireFiniteNumber(candidate, configurationPath(id, path));
    }
  }
}

function validatePhysicalDimensions(id, value) {
  for (const path of POSITIVE_NUMBER_PATHS) {
    const candidate = readPath(value, path);
    if (candidate <= 0) {
      throw new Error(`Configuration '${configurationPath(id, path)}' must be > 0.`);
    }
  }

  for (const path of NON_NEGATIVE_NUMBER_PATHS) {
    const candidate = readPath(value, path);
    if (candidate < 0) {
      throw new Error(`Configuration '${configurationPath(id, path)}' must be >= 0.`);
    }
  }

  for (const path of UNIT_INTERVAL_PATHS) {
    const candidate = readPath(value, path);
    if (candidate < 0 || candidate > 1) {
      throw new Error(`Configuration '${configurationPath(id, path)}' must be within [0, 1].`);
    }
  }

  if (value.trunk.topRadius > value.trunk.baseRadius) {
    throw new Error(
      `Configuration '${id}.trunk.topRadius' must not exceed '${id}.trunk.baseRadius'.`,
    );
  }
}

function validateCounts(id, value) {
  for (const { path, minimum } of INTEGER_RULES) {
    requireInteger(readPath(value, path), configurationPath(id, path), minimum);
  }
}

function validatePairs(id, value) {
  for (const { path, positive, integer } of PAIR_RULES) {
    requirePair(readPath(value, path), configurationPath(id, path), {
      positive,
      integer,
    });
  }
}

export function validateTreePresetConfig(id, value) {
  requireNonEmptyString(id, 'tree preset id');
  if (!isObject(value)) {
    throw new Error(`Configuration '${id}' must be an object.`);
  }

  if (value.label !== undefined) {
    requireNonEmptyString(value.label, `${id}.label`);
  }

  validateNumericTypes(id, value);
  validatePhysicalDimensions(id, value);
  validateCounts(id, value);
  validatePairs(id, value);
  requireNonEmptyString(value.trunk?.color, `${id}.trunk.color`);

  return value;
}
