const PROFILE_IDS = Object.freeze(['round', 'columnar', 'vase', 'pad']);
const LOD_COUNT = 3;

const DEFAULT_PROFILE_CONFIGS = Object.freeze({
  round: Object.freeze({
    bridgeRadiusRatio: 0.3,
    bridgeLengthPaddingRatio: 0.18,
    coreOverlapSafety: 0.88,
    sameMacroOnly: false,
    verticalBias: 0.04,
    lod: Object.freeze([
      Object.freeze({ coreScale: 1, bridges: true }),
      Object.freeze({ coreScale: 1.04, bridges: true }),
      Object.freeze({ coreScale: 1.12, bridges: true }),
    ]),
  }),
  columnar: Object.freeze({
    bridgeRadiusRatio: 0.36,
    bridgeLengthPaddingRatio: 0.22,
    coreOverlapSafety: 0.86,
    sameMacroOnly: false,
    verticalBias: 0.38,
    lod: Object.freeze([
      Object.freeze({ coreScale: 1.02, bridges: true }),
      Object.freeze({ coreScale: 1.09, bridges: true }),
      Object.freeze({ coreScale: 1.18, bridges: true }),
    ]),
  }),
  vase: Object.freeze({
    bridgeRadiusRatio: 0.33,
    bridgeLengthPaddingRatio: 0.2,
    coreOverlapSafety: 0.87,
    sameMacroOnly: false,
    verticalBias: 0.14,
    lod: Object.freeze([
      Object.freeze({ coreScale: 1, bridges: true }),
      Object.freeze({ coreScale: 1.06, bridges: true }),
      Object.freeze({ coreScale: 1.14, bridges: true }),
    ]),
  }),
  pad: Object.freeze({
    bridgeRadiusRatio: 0.31,
    bridgeLengthPaddingRatio: 0.18,
    coreOverlapSafety: 0.88,
    sameMacroOnly: true,
    verticalBias: 0.08,
    lod: Object.freeze([
      Object.freeze({ coreScale: 1, bridges: true }),
      Object.freeze({ coreScale: 1.05, bridges: true }),
      Object.freeze({ coreScale: 1.12, bridges: true }),
    ]),
  }),
});

function requireRange(value, minimum, maximum, path) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < minimum || number > maximum) {
    throw new RangeError(`${path} must be within [${minimum}, ${maximum}].`);
  }
  return number;
}

function requireBoolean(value, path) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${path} must be a boolean.`);
  }
  return value;
}

function createLodConfig(source, fallback, path) {
  const values = source ?? fallback;
  if (!Array.isArray(values) || values.length !== LOD_COUNT) {
    throw new Error(`${path} must contain exactly ${LOD_COUNT} entries.`);
  }

  return Object.freeze(
    values.map((value, index) => {
      const fallbackValue = fallback[index];
      const current = value ?? fallbackValue;
      return Object.freeze({
        coreScale: requireRange(
          current.coreScale ?? fallbackValue.coreScale,
          0.8,
          1.4,
          `${path}[${index}].coreScale`,
        ),
        bridges: requireBoolean(
          current.bridges ?? fallbackValue.bridges,
          `${path}[${index}].bridges`,
        ),
      });
    }),
  );
}

function sourceForProfile(config, profile) {
  if (!config) return {};
  if (config.profiles) return config.profiles[profile] ?? {};
  return config;
}

export function resolveFoliageContinuityProfile(config, profile) {
  const profileId = PROFILE_IDS.includes(profile) ? profile : 'round';
  const fallback = DEFAULT_PROFILE_CONFIGS[profileId];
  const source = sourceForProfile(config, profileId);
  const path = `foliageContinuity.profiles.${profileId}`;

  return Object.freeze({
    profile: profileId,
    bridgeRadiusRatio: requireRange(
      source.bridgeRadiusRatio ?? fallback.bridgeRadiusRatio,
      0.1,
      0.75,
      `${path}.bridgeRadiusRatio`,
    ),
    bridgeLengthPaddingRatio: requireRange(
      source.bridgeLengthPaddingRatio ?? fallback.bridgeLengthPaddingRatio,
      0,
      0.75,
      `${path}.bridgeLengthPaddingRatio`,
    ),
    coreOverlapSafety: requireRange(
      source.coreOverlapSafety ?? fallback.coreOverlapSafety,
      0.5,
      1,
      `${path}.coreOverlapSafety`,
    ),
    sameMacroOnly: requireBoolean(
      source.sameMacroOnly ?? fallback.sameMacroOnly,
      `${path}.sameMacroOnly`,
    ),
    verticalBias: requireRange(
      source.verticalBias ?? fallback.verticalBias,
      0,
      0.75,
      `${path}.verticalBias`,
    ),
    lod: createLodConfig(source.lod, fallback.lod, `${path}.lod`),
  });
}

export const FOLIAGE_CONTINUITY_PROFILE_IDS = PROFILE_IDS;
