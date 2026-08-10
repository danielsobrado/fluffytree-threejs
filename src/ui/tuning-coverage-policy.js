const AUTO_FIT_GAP_TARGET_RATIO = 0.85;
const AUTO_FIT_LEAF_AREA_MARGIN = 0.5;

function requireThresholds(thresholds, presetId) {
  if (!thresholds) {
    throw new Error(`Missing studio coverage thresholds for '${presetId}'.`);
  }
  return thresholds;
}

export function evaluateTuningCoverage(report, thresholds, presetId = 'preset') {
  const limits = requireThresholds(thresholds, presetId);
  const gapPassed = report.gapCardRatio <= limits.gapCardRatio;
  const areaPassed = report.leafAreaIndex >= limits.minimumLeafAreaIndex;
  const barePassed = report.bareExposedLobes <= limits.bareExposedLobes;
  const candidatePassed =
    report.candidateCoverageRatio <= limits.maximumCandidateCoverageRatio;
  const continuousPassed = report.continuous?.passed === true;

  return Object.freeze({
    gapPassed,
    areaPassed,
    barePassed,
    candidatePassed,
    continuousPassed,
    passed:
      gapPassed &&
      areaPassed &&
      barePassed &&
      candidatePassed &&
      continuousPassed,
  });
}

export function tuningCoverageAutoFitTargets(thresholds, presetId = 'preset') {
  const limits = requireThresholds(thresholds, presetId);
  return Object.freeze({
    gapCardRatio: limits.gapCardRatio * AUTO_FIT_GAP_TARGET_RATIO,
    minimumLeafAreaIndex:
      limits.minimumLeafAreaIndex + AUTO_FIT_LEAF_AREA_MARGIN,
  });
}
