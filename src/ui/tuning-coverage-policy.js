import { evaluateShellCoverageQa } from '../qa/shell-coverage-qa-evaluator.js';

const AUTO_FIT_GAP_TARGET_RATIO = 0.85;
const AUTO_FIT_LEAF_AREA_MARGIN = 0.5;

function requireThresholds(thresholds, presetId) {
  if (!thresholds) {
    throw new Error(`Missing studio coverage thresholds for '${presetId}'.`);
  }
  return thresholds;
}

function normalizeReport(report) {
  return {
    ...report,
    candidateCoverageRatio: report.candidateCoverageRatio ?? 0,
    maximumPhysicalCoverageRatio: report.maximumPhysicalCoverageRatio ?? 0,
    continuous: report.continuous ?? { passed: true },
  };
}

export function evaluateTuningCoverage(report, thresholds, presetId = 'preset') {
  const limits = requireThresholds(thresholds, presetId);
  return evaluateShellCoverageQa(normalizeReport(report), limits);
}

export function tuningCoverageAutoFitTargets(thresholds, presetId = 'preset') {
  const limits = requireThresholds(thresholds, presetId);
  return Object.freeze({
    gapCardRatio: limits.gapCardRatio * AUTO_FIT_GAP_TARGET_RATIO,
    minimumLeafAreaIndex:
      limits.minimumLeafAreaIndex + AUTO_FIT_LEAF_AREA_MARGIN,
  });
}
