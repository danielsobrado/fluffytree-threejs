import { FOLIAGE_SHELL_CONSTANTS } from '../generation/foliage-shell-constants.js?v=2.0.0-20260814.2';

export function evaluateShellCoverageQa(report, thresholds) {
  const physicalLimit =
    FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio +
    FOLIAGE_SHELL_CONSTANTS.coverageRatioEpsilon;
  const checks = Object.freeze({
    candidateCoverage:
      report.candidateCoverageRatio <= thresholds.maximumCandidateCoverageRatio,
    physicalCoverage: report.maximumPhysicalCoverageRatio <= physicalLimit,
    gapCardRatio: report.gapCardRatio <= thresholds.gapCardRatio,
    leafAreaIndex: report.leafAreaIndex >= thresholds.minimumLeafAreaIndex,
    bareExposedLobes:
      report.bareExposedLobes <= thresholds.bareExposedLobes,
    continuousCoverage: report.continuous?.passed === true,
  });
  const failures = [];

  if (!checks.candidateCoverage) {
    failures.push(
      `candidateCoverageRatio ${report.candidateCoverageRatio.toFixed(6)} > ` +
        `${thresholds.maximumCandidateCoverageRatio}`,
    );
  }
  if (!checks.physicalCoverage) {
    failures.push(
      `physicalCoverageRatio ${report.maximumPhysicalCoverageRatio.toFixed(6)} > ` +
        `${FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio}`,
    );
  }
  if (!checks.gapCardRatio) {
    failures.push(
      `gapCardRatio ${report.gapCardRatio.toFixed(4)} > ${thresholds.gapCardRatio}`,
    );
  }
  if (!checks.leafAreaIndex) {
    failures.push(
      `leafAreaIndex ${report.leafAreaIndex.toFixed(3)} < ${thresholds.minimumLeafAreaIndex}`,
    );
  }
  if (!checks.bareExposedLobes) {
    failures.push(
      `bareExposedLobes ${report.bareExposedLobes} > ${thresholds.bareExposedLobes}`,
    );
  }
  if (!checks.continuousCoverage) {
    failures.push(
      `continuousCoverage uncovered=${report.continuous?.uncoveredTriangleCount ?? 'unknown'} ` +
        `depth=${report.continuous?.maximumDepthReached ?? 'unknown'}`,
    );
  }

  return Object.freeze({
    passed: failures.length === 0,
    checks,
    failures: Object.freeze(failures),
  });
}
