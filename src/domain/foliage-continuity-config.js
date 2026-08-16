const PROFILE_IDS = Object.freeze(['round', 'columnar', 'vase', 'pad']);
const LOD_COUNT = 3;

const DEFAULT_PROFILE_CONFIGS = Object.freeze({
  round: Object.freeze({
    bridgeRadiusRatio: 0.3,
    bridgeLengthPaddingRatio: 0.18,
    coreOverlapSafety: 0.88,
    sameMacroOnly: false,
    verticalBias: 0.04,
    maximumShellCardWidthSpread: 1.4,
    shellCoverageRepairBudgetRatio: 0.10,
    shellCoverageEmergencyBudgetRatio: 0.24,
    shellCoverageRepairStopRatio: 0.5,
    shellCoverageRepairMaximumSubdivisionDepth: 4,
    shellCoverageCertificationMaximumSubdivisionDepth: 6,
    shellCoverageRepairMinimumDirectionDiameter: 0.055,
    shellCoverageRepairPasses: 2,
    shellCoverageRepairNormalUncertaintyScale: 1,
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
    maximumShellCardWidthSpread: 2.5,
    shellCoverageRepairBudgetRatio: 0.08,
    shellCoverageEmergencyBudgetRatio: 0.20,
    shellCoverageRepairStopRatio: 0.5,
    shellCoverageRepairMaximumSubdivisionDepth: 4,
    shellCoverageCertificationMaximumSubdivisionDepth: 6,
    shellCoverageRepairMinimumDirectionDiameter: 0.05,
    shellCoverageRepairPasses: 2,
    shellCoverageRepairNormalUncertaintyScale: 1,
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
    maximumShellCardWidthSpread: 2.6,
    shellCoverageRepairBudgetRatio: 0.12,
    shellCoverageEmergencyBudgetRatio: 0.28,
    shellCoverageRepairStopRatio: 0.5,
    shellCoverageRepairMaximumSubdivisionDepth: 5,
    shellCoverageCertificationMaximumSubdivisionDepth: 7,
    shellCoverageRepairMinimumDirectionDiameter: 0.045,
    shellCoverageRepairPasses: 2,
    shellCoverageRepairNormalUncertaintyScale: 1,
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
    maximumShellCardWidthSpread: 2.5,
    shellCoverageRepairBudgetRatio: 0.14,
    shellCoverageEmergencyBudgetRatio: 0.32,
    shellCoverageRepairStopRatio: 0.5,
    shellCoverageRepairMaximumSubdivisionDepth: 5,
    shellCoverageCertificationMaximumSubdivisionDepth: 7,
    shellCoverageRepairMinimumDirectionDiameter: 0.04,
    shellCoverageRepairPasses: 3,
    shellCoverageRepairNormalUncertaintyScale: 1,
    lod: Object.freeze([
      Object.freeze({ coreScale: 1, bridges: true }),
      Object.freeze({ coreScale: 1.05, bridges: true }),
      Object.freeze({ coreScale: 1.12, bridges: true }),
    ]),
  }),
});

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireObject(value, path) {
  if (!isObject(value)) {
    throw new TypeError(`${path} must be an object.`);
  }
  return value;
}

function requireRange(value, minimum, maximum, path) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum
  ) {
    throw new RangeError(`${path} must be a finite number within [${minimum}, ${maximum}].`);
  }
  return value;
}

function requireIntegerRange(value, minimum, maximum, path) {
  const number = requireRange(value, minimum, maximum, path);
  if (!Number.isSafeInteger(number)) {
    throw new RangeError(`${path} must be an integer.`);
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
      requireObject(current, `${path}[${index}]`);
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
  if (config === null || config === undefined) return {};
  requireObject(config, 'foliageContinuity');

  if (config.profiles === undefined) return config;

  const profiles = requireObject(config.profiles, 'foliageContinuity.profiles');
  const source = profiles[profile];
  if (source === undefined || source === null) return {};
  return requireObject(source, `foliageContinuity.profiles.${profile}`);
}

function repairBudgetRatio(source, fallback, path) {
  return requireRange(
    source.shellCoverageRepairBudgetRatio ??
      source.shellCoverageRepairProbeRatio ??
      fallback.shellCoverageRepairBudgetRatio,
    0,
    1,
    `${path}.shellCoverageRepairBudgetRatio`,
  );
}

function resolveCoverageLimits(source, fallback, path) {
  const repairBudget = repairBudgetRatio(source, fallback, path);
  const emergencyBudget = requireRange(
    source.shellCoverageEmergencyBudgetRatio ??
      fallback.shellCoverageEmergencyBudgetRatio,
    0,
    1,
    `${path}.shellCoverageEmergencyBudgetRatio`,
  );
  if (emergencyBudget < repairBudget) {
    throw new RangeError(
      `${path}.shellCoverageEmergencyBudgetRatio must be >= shellCoverageRepairBudgetRatio.`,
    );
  }

  const repairDepth = requireIntegerRange(
    source.shellCoverageRepairMaximumSubdivisionDepth ??
      fallback.shellCoverageRepairMaximumSubdivisionDepth,
    1,
    8,
    `${path}.shellCoverageRepairMaximumSubdivisionDepth`,
  );
  const certificationDepth = requireIntegerRange(
    source.shellCoverageCertificationMaximumSubdivisionDepth ??
      fallback.shellCoverageCertificationMaximumSubdivisionDepth,
    1,
    10,
    `${path}.shellCoverageCertificationMaximumSubdivisionDepth`,
  );
  if (certificationDepth < repairDepth) {
    throw new RangeError(
      `${path}.shellCoverageCertificationMaximumSubdivisionDepth must be >= shellCoverageRepairMaximumSubdivisionDepth.`,
    );
  }

  return Object.freeze({
    repairBudget,
    emergencyBudget,
    repairDepth,
    certificationDepth,
  });
}

export function resolveFoliageContinuityProfile(config, profile) {
  const profileId = PROFILE_IDS.includes(profile) ? profile : 'round';
  const fallback = DEFAULT_PROFILE_CONFIGS[profileId];
  const source = sourceForProfile(config, profileId);
  const path = `foliageContinuity.profiles.${profileId}`;
  const coverage = resolveCoverageLimits(source, fallback, path);

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
    maximumShellCardWidthSpread: requireRange(
      source.maximumShellCardWidthSpread ??
        fallback.maximumShellCardWidthSpread,
      1,
      4,
      `${path}.maximumShellCardWidthSpread`,
    ),
    shellCoverageRepairBudgetRatio: coverage.repairBudget,
    shellCoverageEmergencyBudgetRatio: coverage.emergencyBudget,
    shellCoverageRepairStopRatio: requireRange(
      source.shellCoverageRepairStopRatio ??
        fallback.shellCoverageRepairStopRatio,
      0.1,
      1,
      `${path}.shellCoverageRepairStopRatio`,
    ),
    shellCoverageRepairMaximumSubdivisionDepth: coverage.repairDepth,
    shellCoverageCertificationMaximumSubdivisionDepth: coverage.certificationDepth,
    shellCoverageRepairMinimumDirectionDiameter: requireRange(
      source.shellCoverageRepairMinimumDirectionDiameter ??
        fallback.shellCoverageRepairMinimumDirectionDiameter,
      0.005,
      0.25,
      `${path}.shellCoverageRepairMinimumDirectionDiameter`,
    ),
    shellCoverageRepairPasses: requireIntegerRange(
      source.shellCoverageRepairPasses ?? fallback.shellCoverageRepairPasses,
      1,
      4,
      `${path}.shellCoverageRepairPasses`,
    ),
    shellCoverageRepairNormalUncertaintyScale: requireRange(
      source.shellCoverageRepairNormalUncertaintyScale ??
        fallback.shellCoverageRepairNormalUncertaintyScale,
      0.25,
      2,
      `${path}.shellCoverageRepairNormalUncertaintyScale`,
    ),
    lod: createLodConfig(source.lod, fallback.lod, `${path}.lod`),
  });
}

export const FOLIAGE_CONTINUITY_PROFILE_IDS = PROFILE_IDS;
