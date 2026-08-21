import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js?v=2.0.0-20260814.2';

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveFoliageCoveragePolicy(alphaProfile, continuity) {
  const opaqueAreaRatio = Number(alphaProfile?.opaqueAreaRatio);
  if (
    !Number.isFinite(opaqueAreaRatio) ||
    opaqueAreaRatio <= 0 ||
    opaqueAreaRatio > 1
  ) {
    throw new RangeError('Foliage alpha opaqueAreaRatio must be within (0, 1].');
  }

  const sparseShapeMultiplier = clamp(
    FOLIAGE_SHELL_CONSTANTS.referenceOpaqueAreaRatio / opaqueAreaRatio,
    1,
    FOLIAGE_SHELL_CONSTANTS.maximumSparseShapeRepairMultiplier,
  );
  const stopMultiplier = Math.max(
    FOLIAGE_SHELL_CONSTANTS.minimumSparseShapeStopMultiplier,
    1 / sparseShapeMultiplier,
  );
  const directionScale = Math.sqrt(sparseShapeMultiplier);

  return Object.freeze({
    repairBudgetRatio: Math.min(
      1,
      continuity.shellCoverageRepairBudgetRatio * sparseShapeMultiplier,
    ),
    emergencyRepairBudgetRatio: Math.min(
      1,
      continuity.shellCoverageEmergencyBudgetRatio * sparseShapeMultiplier,
    ),
    stopCoverageRatio:
      continuity.shellCoverageRepairStopRatio * stopMultiplier,
    maximumSubdivisionDepth:
      continuity.shellCoverageRepairMaximumSubdivisionDepth,
    certificationMaximumSubdivisionDepth:
      continuity.shellCoverageCertificationMaximumSubdivisionDepth,
    minimumDirectionDiameter:
      continuity.shellCoverageRepairMinimumDirectionDiameter / directionScale,
    certificationMinimumDirectionDiameter:
      (continuity.shellCoverageRepairMinimumDirectionDiameter *
        FOLIAGE_SHELL_CONSTANTS.coverageCertificationMinimumDirectionScale) /
      directionScale,
    maximumPasses: continuity.shellCoverageRepairPasses,
    normalUncertaintyScale:
      continuity.shellCoverageRepairNormalUncertaintyScale,
    sparseShapeMultiplier,
  });
}

export function calculateFoliageRepairBudget(candidateCount, budgetRatio) {
  if (!Number.isSafeInteger(candidateCount) || candidateCount < 0) {
    throw new RangeError('Foliage repair candidateCount must be non-negative.');
  }
  if (!Number.isFinite(budgetRatio) || budgetRatio < 0 || budgetRatio > 1) {
    throw new RangeError('Foliage repair budgetRatio must be within [0, 1].');
  }

  return Math.ceil(candidateCount * budgetRatio);
}
