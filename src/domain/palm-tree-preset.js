import { PALM_TREE_LIMITS, PALM_TREE_MODEL_ID } from '../generation/palm-tree-constants.js';

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`Configuration '${path}' must be an object.`);
  }
  return value;
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new TypeError(`Configuration '${path}' must be a non-empty string.`);
  }
  return value;
}

function requireRange(value, range, path) {
  if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
    throw new RangeError(
      `Configuration '${path}' must be within [${range[0]}, ${range[1]}].`,
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

function requireInteger(value, range, path) {
  requireRange(value, range, path);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Configuration '${path}' must be an integer.`);
  }
  return value;
}

function requirePair(value, range, path) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new TypeError(`Configuration '${path}' must contain two numbers.`);
  }
  const minimum = requireRange(value[0], range, `${path}[0]`);
  const maximum = requireRange(value[1], range, `${path}[1]`);
  if (maximum < minimum) {
    throw new RangeError(`Configuration '${path}' must be [minimum, maximum].`);
  }
  return Object.freeze([minimum, maximum]);
}

function requireVector2(value, path) {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !value.every(Number.isFinite)
  ) {
    throw new TypeError(`Configuration '${path}' must contain two finite numbers.`);
  }
  return Object.freeze([...value]);
}

function requireColor(value, path) {
  requireString(value, path);
  if (!HEX_COLOR_PATTERN.test(value)) {
    throw new TypeError(`Configuration '${path}' must be a #RRGGBB color.`);
  }
  return value;
}

function requirePalette(value, path) {
  if (!Array.isArray(value) || value.length < 2) {
    throw new TypeError(`Configuration '${path}' must contain at least two colors.`);
  }
  value.forEach((color, index) => requireColor(color, `${path}[${index}]`));
  return Object.freeze([...value]);
}

export function createPalmTreePreset(id, value) {
  requireString(id, 'tree preset id');
  requireObject(value, id);
  if (value.generationModel !== PALM_TREE_MODEL_ID) {
    throw new Error(
      `Configuration '${id}.generationModel' must be '${PALM_TREE_MODEL_ID}'.`,
    );
  }
  const height = requirePositive(value.height, `${id}.height`);
  const morphology = requireObject(value.morphology, `${id}.morphology`);
  const trunk = requireObject(value.trunk, `${id}.trunk`);
  const foliage = requireObject(value.foliage, `${id}.foliage`);
  const baseRadius = requirePositive(trunk.baseRadius, `${id}.trunk.baseRadius`);
  const topRadius = requirePositive(trunk.topRadius, `${id}.trunk.topRadius`);
  if (topRadius > baseRadius) {
    throw new RangeError(`Configuration '${id}.trunk.topRadius' must not exceed baseRadius.`);
  }

  return Object.freeze({
    id,
    label: value.label ?? id,
    generationModel: PALM_TREE_MODEL_ID,
    height,
    morphology: Object.freeze({
      frondCount: requireInteger(
        morphology.frondCount,
        PALM_TREE_LIMITS.frondCount,
        `${id}.morphology.frondCount`,
      ),
      frondSegments: requireInteger(
        morphology.frondSegments,
        PALM_TREE_LIMITS.frondSegments,
        `${id}.morphology.frondSegments`,
      ),
      frondLength: requirePair(
        morphology.frondLength,
        PALM_TREE_LIMITS.frondLength,
        `${id}.morphology.frondLength`,
      ),
      frondWidth: requirePair(
        morphology.frondWidth,
        PALM_TREE_LIMITS.frondWidth,
        `${id}.morphology.frondWidth`,
      ),
      frondDroop: requireRange(
        morphology.frondDroop,
        PALM_TREE_LIMITS.frondDroop,
        `${id}.morphology.frondDroop`,
      ),
      frondRise: requireRange(
        morphology.frondRise,
        PALM_TREE_LIMITS.frondRise,
        `${id}.morphology.frondRise`,
      ),
      skirtRatio: requireRange(
        morphology.skirtRatio,
        PALM_TREE_LIMITS.skirtRatio,
        `${id}.morphology.skirtRatio`,
      ),
      spiralOffset: requireRange(
        morphology.spiralOffset,
        PALM_TREE_LIMITS.spiralOffset,
        `${id}.morphology.spiralOffset`,
      ),
    }),
    trunk: Object.freeze({
      baseRadius,
      topRadius,
      segments: requireInteger(trunk.segments, [3, 64], `${id}.trunk.segments`),
      flare: requireRange(trunk.flare, [0, 1.5], `${id}.trunk.flare`),
      taperPower: requireRange(
        trunk.taperPower,
        PALM_TREE_LIMITS.taperPower,
        `${id}.trunk.taperPower`,
      ),
      curve: requireRange(
        trunk.curve,
        PALM_TREE_LIMITS.trunkCurve,
        `${id}.trunk.curve`,
      ),
      lean: requireVector2(trunk.lean, `${id}.trunk.lean`),
      color: requireColor(trunk.color, `${id}.trunk.color`),
      barkPalette: requirePalette(trunk.barkPalette, `${id}.trunk.barkPalette`),
    }),
    foliage: Object.freeze({
      palette: requirePalette(foliage.palette, `${id}.foliage.palette`),
      roughness: requireRange(foliage.roughness, [0, 1], `${id}.foliage.roughness`),
    }),
  });
}
