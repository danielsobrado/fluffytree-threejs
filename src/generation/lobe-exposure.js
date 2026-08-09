import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { normalizedRotatedPointDistance } from './lobe-geometry.js';

const CLEARANCE_SATURATION =
  FOLIAGE_SHELL_CONSTANTS.clearanceRange -
  FOLIAGE_SHELL_CONSTANTS.clearanceOffset;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createExposureTransform(lobe) {
  const rotation = lobe.rotation ?? { x: 0, y: 0, z: 0 };
  const inverseX = -rotation.x;
  const inverseY = -rotation.y;
  const inverseZ = -rotation.z;

  return Object.freeze({
    inverseScaleX: 1 / lobe.scale.x,
    inverseScaleY: 1 / lobe.scale.y,
    inverseScaleZ: 1 / lobe.scale.z,
    cosX: Math.cos(inverseX),
    sinX: Math.sin(inverseX),
    cosY: Math.cos(inverseY),
    sinY: Math.sin(inverseY),
    cosZ: Math.cos(inverseZ),
    sinZ: Math.sin(inverseZ),
  });
}

function preparedNormalizedDistance(point, lobe) {
  const transform = lobe.exposureTransform;
  if (!transform) return normalizedRotatedPointDistance(point, lobe);

  const x = point.x - lobe.position.x;
  const y = point.y - lobe.position.y;
  const z = point.z - lobe.position.z;
  const xAfterZ = x * transform.cosZ - y * transform.sinZ;
  const yAfterZ = x * transform.sinZ + y * transform.cosZ;
  const xAfterY = xAfterZ * transform.cosY + z * transform.sinY;
  const zAfterY = -xAfterZ * transform.sinY + z * transform.cosY;
  const yAfterX = yAfterZ * transform.cosX - zAfterY * transform.sinX;
  const zAfterX = yAfterZ * transform.sinX + zAfterY * transform.cosX;

  return Math.hypot(
    xAfterY * transform.inverseScaleX,
    yAfterX * transform.inverseScaleY,
    zAfterX * transform.inverseScaleZ,
  );
}

export function prepareExposureLobes(sourceLobes) {
  return sourceLobes.map((lobe) => ({
    ...lobe,
    boundingRadius:
      lobe.boundingRadius ?? Math.max(lobe.scale.x, lobe.scale.y, lobe.scale.z),
    minimumRadius: Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z),
    exposureTransform: createExposureTransform(lobe),
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
      preparedNormalizedDistance(point, lobe) - 1,
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
