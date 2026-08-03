import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { normalizedRotatedPointDistance } from './lobe-geometry.js';

const CLEARANCE_SATURATION =
  FOLIAGE_SHELL_CONSTANTS.clearanceRange -
  FOLIAGE_SHELL_CONSTANTS.clearanceOffset;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function prepareExposureLobes(sourceLobes) {
  return sourceLobes.map((lobe) => ({
    ...lobe,
    boundingRadius:
      lobe.boundingRadius ?? Math.max(lobe.scale.x, lobe.scale.y, lobe.scale.z),
    minimumRadius: Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z),
  }));
}

export function calculateLobeClearance(point, lobes, ownerLobeId) {
  let minimum = CLEARANCE_SATURATION;

  for (const lobe of lobes) {
    if (lobe.id === ownerLobeId) continue;

    const dx = point.x - lobe.position.x;
    const dy = point.y - lobe.position.y;
    const dz = point.z - lobe.position.z;
    const reach = lobe.boundingRadius * (1 + CLEARANCE_SATURATION);
    if (dx * dx + dy * dy + dz * dz > reach * reach) continue;

    minimum = Math.min(
      minimum,
      normalizedRotatedPointDistance(point, lobe) - 1,
    );
  }

  return minimum;
}

export function clearanceToExposure(clearance) {
  return clamp01(
    (clearance + FOLIAGE_SHELL_CONSTANTS.clearanceOffset) /
      FOLIAGE_SHELL_CONSTANTS.clearanceRange,
  );
}

export function calculateLobeExposure(point, lobes, ownerLobeId) {
  return clearanceToExposure(
    calculateLobeClearance(point, lobes, ownerLobeId),
  );
}

export function calculateExposureLipschitz(lobes, ownerLobeId) {
  let maximumDistanceLipschitz = 0;

  for (const lobe of lobes) {
    if (lobe.id === ownerLobeId) continue;
    const minimumRadius =
      lobe.minimumRadius ?? Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z);
    maximumDistanceLipschitz = Math.max(
      maximumDistanceLipschitz,
      1 / Math.max(minimumRadius, Number.EPSILON),
    );
  }

  return maximumDistanceLipschitz / FOLIAGE_SHELL_CONSTANTS.clearanceRange;
}
