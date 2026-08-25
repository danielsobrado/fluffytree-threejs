import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { normalizedRotatedPointDistance } from './lobe-geometry.js';

const CLEARANCE_SATURATION =
  FOLIAGE_SHELL_CONSTANTS.clearanceRange -
  FOLIAGE_SHELL_CONSTANTS.clearanceOffset;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function createSurfaceTransform(lobe) {
  const rotation = lobe.rotation ?? { x: 0, y: 0, z: 0 };
  return Object.freeze({
    cosX: Math.cos(rotation.x),
    sinX: Math.sin(rotation.x),
    cosY: Math.cos(rotation.y),
    sinY: Math.sin(rotation.y),
    cosZ: Math.cos(rotation.z),
    sinZ: Math.sin(rotation.z),
  });
}

function createExposureTransform(lobe, surfaceTransform) {
  return Object.freeze({
    inverseScaleX: 1 / lobe.scale.x,
    inverseScaleY: 1 / lobe.scale.y,
    inverseScaleZ: 1 / lobe.scale.z,
    cosX: surfaceTransform.cosX,
    sinX: -surfaceTransform.sinX,
    cosY: surfaceTransform.cosY,
    sinY: -surfaceTransform.sinY,
    cosZ: surfaceTransform.cosZ,
    sinZ: -surfaceTransform.sinZ,
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
  return sourceLobes.map((lobe) => {
    const surfaceTransform = createSurfaceTransform(lobe);
    return {
      ...lobe,
      boundingRadius:
        lobe.boundingRadius ?? Math.max(lobe.scale.x, lobe.scale.y, lobe.scale.z),
      minimumRadius: Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z),
      surfaceTransform,
      exposureTransform: createExposureTransform(lobe, surfaceTransform),
    };
  });
}

/**
 * The lobes each lobe's own surface can ever be shaded by.
 *
 * A clearance query rejects a lobe whose inflated reach does not contain the
 * queried point, and every point it is asked about lies on the owner's surface,
 * within one bounding radius of the owner's centre. A lobe further away than
 * that plus its own reach therefore fails the test for every point on the
 * owner, so it can be dropped once instead of re-tested per candidate.
 */
export function buildExposureNeighborhoods(lobes) {
  const neighborhoods = new Map();

  for (const owner of lobes) {
    const near = [];

    for (const lobe of lobes) {
      if (lobe.id === owner.id) continue;

      const limit =
        owner.boundingRadius + lobe.boundingRadius * (1 + CLEARANCE_SATURATION);
      const dx = owner.position.x - lobe.position.x;
      const dy = owner.position.y - lobe.position.y;
      const dz = owner.position.z - lobe.position.z;
      if (dx * dx + dy * dy + dz * dz <= limit * limit) near.push(lobe);
    }

    neighborhoods.set(owner.id, near);
  }

  return neighborhoods;
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
