const MAXIMUM_SEED = 0xffffffff;

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Configuration '${path}' must be an object.`);
  }
  return value;
}

function requireFiniteRange(value, minimum, maximum, path) {
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

function requirePositiveFinite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a finite number > 0.`);
  }
  return value;
}

function requireNonNegativeFinite(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Configuration '${path}' must be a finite number >= 0.`);
  }
  return value;
}

function requirePositiveInteger(value, path) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`Configuration '${path}' must be a positive integer.`);
  }
  return value;
}

function requireNonNegativeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Configuration '${path}' must be a non-negative integer.`);
  }
  return value;
}

function requireUint32(value, path, { positive = false } = {}) {
  if (
    !Number.isSafeInteger(value) ||
    value < (positive ? 1 : 0) ||
    value > MAXIMUM_SEED
  ) {
    throw new Error(
      `Configuration '${path}' must be ${positive ? 'a positive' : 'an'} unsigned 32-bit integer.`,
    );
  }
  return value;
}

function parseProbe(config) {
  const probe = requireObject(config?.probe, 'shell-coverage-qa.probe');
  const continuous = requireObject(
    probe.continuous,
    'shell-coverage-qa.probe.continuous',
  );

  return Object.freeze({
    probeDensityMultiplier: requirePositiveFinite(
      probe.probeDensityMultiplier,
      'shell-coverage-qa.probe.probeDensityMultiplier',
    ),
    probeExposureMargin: requireFiniteRange(
      probe.probeExposureMargin,
      0,
      1,
      'shell-coverage-qa.probe.probeExposureMargin',
    ),
    continuous: Object.freeze({
      maximumCoverageRatio: requireNonNegativeFinite(
        continuous.maximumCoverageRatio,
        'shell-coverage-qa.probe.continuous.maximumCoverageRatio',
      ),
      maximumSubdivisionDepth: requireNonNegativeInteger(
        continuous.maximumSubdivisionDepth,
        'shell-coverage-qa.probe.continuous.maximumSubdivisionDepth',
      ),
      minimumDirectionDiameter: requirePositiveFinite(
        continuous.minimumDirectionDiameter,
        'shell-coverage-qa.probe.continuous.minimumDirectionDiameter',
      ),
      exposureMargin: requireFiniteRange(
        continuous.exposureMargin,
        0,
        1,
        'shell-coverage-qa.probe.continuous.exposureMargin',
      ),
      normalUncertaintyScale: requireNonNegativeFinite(
        continuous.normalUncertaintyScale,
        'shell-coverage-qa.probe.continuous.normalUncertaintyScale',
      ),
      minimumCoverageNormalDot: requireFiniteRange(
        continuous.minimumCoverageNormalDot,
        -1,
        1,
        'shell-coverage-qa.probe.continuous.minimumCoverageNormalDot',
      ),
      maximumFailureExamples: requireNonNegativeInteger(
        continuous.maximumFailureExamples,
        'shell-coverage-qa.probe.continuous.maximumFailureExamples',
      ),
    }),
  });
}

function parseThresholds(config) {
  const source = requireObject(
    config?.thresholds,
    'shell-coverage-qa.thresholds',
  );
  const thresholds = {};

  for (const [presetId, value] of Object.entries(source)) {
    const threshold = requireObject(
      value,
      `shell-coverage-qa.thresholds.${presetId}`,
    );
    thresholds[presetId] = Object.freeze({
      maximumCandidateCoverageRatio: requirePositiveFinite(
        threshold.maximumCandidateCoverageRatio,
        `shell-coverage-qa.thresholds.${presetId}.maximumCandidateCoverageRatio`,
      ),
      gapCardRatio: requireNonNegativeFinite(
        threshold.gapCardRatio,
        `shell-coverage-qa.thresholds.${presetId}.gapCardRatio`,
      ),
      minimumLeafAreaIndex: requireNonNegativeFinite(
        threshold.minimumLeafAreaIndex,
        `shell-coverage-qa.thresholds.${presetId}.minimumLeafAreaIndex`,
      ),
      bareExposedLobes: requireNonNegativeInteger(
        threshold.bareExposedLobes,
        `shell-coverage-qa.thresholds.${presetId}.bareExposedLobes`,
      ),
    });
  }

  if (Object.keys(thresholds).length === 0) {
    throw new Error("Configuration 'shell-coverage-qa.thresholds' must not be empty.");
  }

  return Object.freeze(thresholds);
}

export function parseShellCoverageProbeOptions(config) {
  return parseProbe(config);
}

export function parseShellCoverageQaConfig(config) {
  const run = requireObject(config?.run, 'shell-coverage-qa.run');
  const report = requireObject(config?.report, 'shell-coverage-qa.report');

  return Object.freeze({
    run: Object.freeze({
      seedCount: requirePositiveInteger(
        run.seedCount,
        'shell-coverage-qa.run.seedCount',
      ),
      firstSeed: requireUint32(
        run.firstSeed,
        'shell-coverage-qa.run.firstSeed',
      ),
      seedStep: requireUint32(
        run.seedStep,
        'shell-coverage-qa.run.seedStep',
        { positive: true },
      ),
    }),
    probe: parseProbe(config),
    thresholds: parseThresholds(config),
    report: Object.freeze({
      maxFailures: requireNonNegativeInteger(
        report.maxFailures,
        'shell-coverage-qa.report.maxFailures',
      ),
    }),
  });
}
