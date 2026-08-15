import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function resolveFoliageCoveragePolicy(alphaProfile, continuity) {
  const opaqueAreaRatio = Number(alphaProfile?.opaqueAreaRatio);
  if (!Number.isFinite(opaqueAreaRatio) || opaqueAreaRatio <= 0 || opaqueAreaRatio > 1) {
    throw new RangeError('Foliage alpha opaqueAreaRatio must be within (0, 1].');
  }
  const sparseShapeMultiplier = clamp(
    FOLIAGE_SHELL_CONSTANTS.referenceOpaqueAreaRatio / opaqueAreaRatio,
    1,
    FOLIAGE_SHELL_CONSTANTS.maximumSparseShapeProbeMultiplier,
  );
  const probeRatio = Math.min(
    1,
    continuity.shellCoverageRepairProbeRatio * sparseShapeMultiplier,
  );
  const stopMultiplier = Math.max(
    FOLIAGE_SHELL_CONSTANTS.minimumSparseShapeStopMultiplier,
    1 / sparseShapeMultiplier,
  );

  return Object.freeze({
    probeRatio,
    stopCoverageRatio:
      continuity.shellCoverageRepairStopRatio * stopMultiplier,
    passCount: FOLIAGE_SHELL_CONSTANTS.coverageRepairPassCount,
    sparseShapeMultiplier,
  });
}

export function calculateFoliageRepairProbeCount(candidateCount, probeRatio) {
  if (!Number.isSafeInteger(candidateCount) || candidateCount < 0) {
    throw new RangeError('Foliage repair candidateCount must be non-negative.');
  }
  if (!Number.isFinite(probeRatio) || probeRatio < 0 || probeRatio > 1) {
    throw new RangeError('Foliage repair probeRatio must be within [0, 1].');
  }

  return Math.ceil(candidateCount * probeRatio);
}
