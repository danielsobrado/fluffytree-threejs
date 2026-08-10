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

function requireNonNegativeInteger(value, path) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Configuration '${path}' must be a non-negative integer.`);
  }
  return value;
}

export function parseShellCoverageProbeOptions(config) {
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
