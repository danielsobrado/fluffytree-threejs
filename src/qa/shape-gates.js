function createFailure(metric, actual, expected) {
  return { metric, actual, expected };
}

function checkExact(metrics, metric, expected, failures) {
  if (metrics[metric] !== expected) {
    failures.push(createFailure(metric, metrics[metric], expected));
  }
}

function checkRange(metrics, metric, range, failures) {
  const value = metrics[metric];
  const [minimum, maximum] = range;

  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    failures.push(createFailure(metric, value, range));
  }
}

function checkConfiguredRanges(metrics, ranges, failures) {
  for (const [metric, range] of Object.entries(ranges ?? {})) {
    checkRange(metrics, metric, range, failures);
  }
}

function checkFoliageCounts(metrics, preset, failures) {
  const shellSettings = preset.foliage.shell;
  const shellCount = preset.crown.lobeCount * shellSettings.instancesPerLobe;

  checkExact(metrics, 'shellInstanceCount', shellCount, failures);
  checkExact(
    metrics,
    'leafCardCount',
    shellCount * shellSettings.planesPerCluster,
    failures,
  );
  checkExact(
    metrics,
    'shellMinimumInstancesPerLobe',
    shellSettings.instancesPerLobe,
    failures,
  );
  checkExact(
    metrics,
    'shellMaximumInstancesPerLobe',
    shellSettings.instancesPerLobe,
    failures,
  );
}

export function evaluateShapeGates(metrics, preset, thresholds) {
  const failures = [];
  const common = thresholds.common;
  const profile = thresholds.profiles[preset.crown.profile];

  if (!profile) {
    throw new Error(
      `Missing QA thresholds for profile '${preset.crown.profile}'.`,
    );
  }

  checkExact(metrics, 'lobeCount', preset.crown.lobeCount, failures);
  checkExact(
    metrics,
    'trunkPointCount',
    preset.trunk.segments + 1,
    failures,
  );
  checkFoliageCounts(metrics, preset, failures);

  for (const [metric, expected] of Object.entries(common.exact ?? {})) {
    checkExact(metrics, metric, expected, failures);
  }

  checkConfiguredRanges(metrics, common.ranges, failures);
  checkConfiguredRanges(metrics, profile.ranges, failures);

  const bandMetrics = [
    'lowerLobeCount',
    'middleLobeCount',
    'upperLobeCount',
  ];
  profile.minimumVerticalBandCounts.forEach((minimum, index) => {
    const metric = bandMetrics[index];
    if (metrics[metric] < minimum) {
      failures.push(
        createFailure(metric, metrics[metric], `[${minimum}, Infinity]`),
      );
    }
  });

  return failures;
}
