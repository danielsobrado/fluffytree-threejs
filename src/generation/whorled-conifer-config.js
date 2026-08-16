import {
  WHORLED_CONIFER_LIMITS,
  WHORLED_CONIFER_MODEL_ID,
} from './whorled-conifer-constants.js';

const REQUIRED_FIELDS = Object.freeze([
  'whorlCount',
  'branchesPerWhorl',
  'crownTaperPower',
  'branchSag',
  'branchLengthVariation',
  'whorlTwist',
  'lowerBranchMortality',
  'leaderWander',
  'foliageScale',
]);

function path(preset, field) {
  return `${preset.id}.morphology.${field}`;
}

function requireRange(value, range, configPath) {
  if (!Number.isFinite(value) || value < range[0] || value > range[1]) {
    throw new RangeError(
      `Configuration '${configPath}' must be within [${range[0]}, ${range[1]}].`,
    );
  }
  return value;
}

function requireInteger(value, range, configPath) {
  requireRange(value, range, configPath);
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Configuration '${configPath}' must be an integer.`);
  }
  return value;
}

function requireIntegerPair(value, range, configPath) {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Configuration '${configPath}' must contain two integers.`);
  }
  const minimum = requireInteger(value[0], range, `${configPath}[0]`);
  const maximum = requireInteger(value[1], range, `${configPath}[1]`);
  if (maximum < minimum) {
    throw new RangeError(`Configuration '${configPath}' must be [minimum, maximum].`);
  }
  return Object.freeze([minimum, maximum]);
}

export function parseWhorledConiferConfig(preset) {
  if (preset.generationModel !== WHORLED_CONIFER_MODEL_ID) {
    throw new Error(
      `Preset '${preset.id}' must use generation model '${WHORLED_CONIFER_MODEL_ID}'.`,
    );
  }
  if (!preset.morphology || typeof preset.morphology !== 'object') {
    throw new Error(`Configuration '${preset.id}.morphology' must be an object.`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (preset.morphology[field] === undefined) {
      throw new Error(`Missing required configuration '${path(preset, field)}'.`);
    }
  }
  if (preset.foliage.leafShape !== 'needle') {
    throw new Error(
      `Configuration '${preset.id}.foliage.leafShape' must be 'needle' for ${WHORLED_CONIFER_MODEL_ID}.`,
    );
  }

  const value = preset.morphology;
  return Object.freeze({
    whorlCount: requireInteger(
      value.whorlCount,
      WHORLED_CONIFER_LIMITS.whorlCount,
      path(preset, 'whorlCount'),
    ),
    branchesPerWhorl: requireIntegerPair(
      value.branchesPerWhorl,
      WHORLED_CONIFER_LIMITS.branchesPerWhorl,
      path(preset, 'branchesPerWhorl'),
    ),
    crownTaperPower: requireRange(
      value.crownTaperPower,
      WHORLED_CONIFER_LIMITS.crownTaperPower,
      path(preset, 'crownTaperPower'),
    ),
    branchSag: requireRange(
      value.branchSag,
      WHORLED_CONIFER_LIMITS.branchSag,
      path(preset, 'branchSag'),
    ),
    branchLengthVariation: requireRange(
      value.branchLengthVariation,
      WHORLED_CONIFER_LIMITS.branchLengthVariation,
      path(preset, 'branchLengthVariation'),
    ),
    whorlTwist: requireRange(
      value.whorlTwist,
      WHORLED_CONIFER_LIMITS.whorlTwist,
      path(preset, 'whorlTwist'),
    ),
    lowerBranchMortality: requireRange(
      value.lowerBranchMortality,
      WHORLED_CONIFER_LIMITS.lowerBranchMortality,
      path(preset, 'lowerBranchMortality'),
    ),
    leaderWander: requireRange(
      value.leaderWander,
      WHORLED_CONIFER_LIMITS.leaderWander,
      path(preset, 'leaderWander'),
    ),
    foliageScale: requireRange(
      value.foliageScale,
      WHORLED_CONIFER_LIMITS.foliageScale,
      path(preset, 'foliageScale'),
    ),
  });
}
