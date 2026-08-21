import { createFoliageAlphaProfile } from '../rendering/foliage-alpha-profile.js?v=2.0.0-20260814.2';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js?v=2.0.0-20260814.2';

const CARD_ROTATION_RADIANS = 0.52;
const UNIT_X = Object.freeze({ x: 1, y: 0, z: 0 });
const UNIT_Y = Object.freeze({ x: 0, y: 1, z: 0 });
const UNIT_Z = Object.freeze({ x: 0, y: 0, z: 1 });

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize(vector) {
  const magnitude = length(vector);
  if (magnitude <= Number.EPSILON) return { ...UNIT_Z };
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function normalizeQuaternion(quaternion) {
  const magnitude = Math.hypot(
    quaternion.x,
    quaternion.y,
    quaternion.z,
    quaternion.w,
  );
  return {
    x: quaternion.x / magnitude,
    y: quaternion.y / magnitude,
    z: quaternion.z / magnitude,
    w: quaternion.w / magnitude,
  };
}

function alignmentQuaternion(normal) {
  const target = normalize(normal);
  let real = dot(UNIT_Z, target) + 1;
  let imaginary;

  if (real < 1e-8) {
    real = 0;
    imaginary = { x: 0, y: 1, z: 0 };
  } else {
    imaginary = cross(UNIT_Z, target);
  }

  return normalizeQuaternion({ ...imaginary, w: real });
}

function rotateByQuaternion(vector, quaternion) {
  const qVector = { x: quaternion.x, y: quaternion.y, z: quaternion.z };
  const first = cross(qVector, vector);
  const second = cross(qVector, first);
  return {
    x: vector.x + 2 * (first.x * quaternion.w + second.x),
    y: vector.y + 2 * (first.y * quaternion.w + second.y),
    z: vector.z + 2 * (first.z * quaternion.w + second.z),
  };
}

function createCardBasis(normal, rotation) {
  const alignment = alignmentQuaternion(normal);
  const baseX = rotateByQuaternion(UNIT_X, alignment);
  const baseY = rotateByQuaternion(UNIT_Y, alignment);
  const cosine = Math.cos(rotation);
  const sine = Math.sin(rotation);

  return {
    x: {
      x: baseX.x * cosine + baseY.x * sine,
      y: baseX.y * cosine + baseY.y * sine,
      z: baseX.z * cosine + baseY.z * sine,
    },
    y: {
      x: -baseX.x * sine + baseY.x * cosine,
      y: -baseX.y * sine + baseY.y * cosine,
      z: -baseX.z * sine + baseY.z * cosine,
    },
    z: normalize(normal),
  };
}

/**
 * Per-cluster values that a coverage query rebuilds on every comparison.
 *
 * A cluster is compared against every candidate near it, and its card basis and
 * alpha profile are the same every time: the basis costs a quaternion and two
 * rotations, and rebuilding it dominated selection. Clusters are created once
 * and never mutated, so caching on the object itself is safe.
 */
const CLUSTER_CACHE = new WeakMap();

function clusterCoverageState(cluster) {
  let state = CLUSTER_CACHE.get(cluster);
  if (state) return state;

  const profile = coverageProfile(cluster);
  state = {
    basis: createCardBasis(cluster.normal, Number(cluster.rotation ?? 0)),
    profile,
    maximumRadiusRatio:
      profile.maximumRadiusRatio ?? Number.POSITIVE_INFINITY,
  };
  CLUSTER_CACHE.set(cluster, state);
  return state;
}

function toClusterLocal(position, cluster, basis) {
  const offset = {
    x: position.x - cluster.position.x,
    y: position.y - cluster.position.y,
    z: position.z - cluster.position.z,
  };
  return {
    x: dot(offset, basis.x),
    y: dot(offset, basis.y),
    z: dot(offset, basis.z),
  };
}

function toPlaneLocal(vector, planeIndex) {
  if (planeIndex === 0) return vector;

  const cosine = Math.cos(CARD_ROTATION_RADIANS);
  const sine = Math.sin(CARD_ROTATION_RADIANS);

  if (planeIndex % 2 === 0) {
    // Even secondary cards are rotated around local X by -0.52 radians.
    // Applying the inverse rotation maps a surface point back into card UVs.
    return {
      x: vector.x,
      y: cosine * vector.y - sine * vector.z,
      z: sine * vector.y + cosine * vector.z,
    };
  }

  // Odd secondary cards are rotated around local Y by +0.52 radians.
  return {
    x: cosine * vector.x - sine * vector.z,
    y: vector.y,
    z: sine * vector.x + cosine * vector.z,
  };
}

function coverageProfile(cluster) {
  return (
    cluster.alphaProfile ??
    createFoliageAlphaProfile({
      shapeId: cluster.leafShape,
      alphaTest: cluster.alphaTest,
      planesPerCluster: cluster.planesPerCluster,
    })
  );
}

function isPointOpaque(position, cluster) {
  const width = Number(cluster.cardWidth);
  if (!(width > 0)) return false;

  const state = clusterCoverageState(cluster);
  const { profile, maximumRadiusRatio } = state;
  const local = toClusterLocal(position, cluster, state.basis);
  const rejectionRadiusSquared = maximumRadiusRatio * maximumRadiusRatio;

  for (let planeIndex = 0; planeIndex < profile.planesPerCluster; planeIndex += 1) {
    const plane = toPlaneLocal(local, planeIndex);
    const u = plane.x / width;
    const v = plane.y / width;
    // No opaque texel of this shape reaches that far from the card centre, so
    // the four texels a bilinear fetch would blend are all transparent. Skips
    // the sampling for the many pairs that are near enough to be worth testing
    // but too far to touch.
    if (u * u + v * v > rejectionRadiusSquared) continue;
    if (profile.isOpaque(u, v)) return true;
  }

  return false;
}

function coverageTargetPosition(item) {
  return item.surfacePoint ?? item.position;
}

export function foliageCardCoverageRatio(candidate, selected) {
  if (
    dot(candidate.normal, selected.normal) <
    FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot
  ) {
    return Number.POSITIVE_INFINITY;
  }

  const target = coverageTargetPosition(candidate);
  const distance = Math.hypot(
    target.x - selected.position.x,
    target.y - selected.position.y,
    target.z - selected.position.z,
  );
  const hasAlphaProfile =
    Number(selected.cardWidth) > 0 &&
    typeof selected.leafShape === 'string' &&
    Number.isFinite(Number(selected.alphaTest)) &&
    Number.isSafeInteger(Number(selected.planesPerCluster));

  if (hasAlphaProfile && !isPointOpaque(target, selected)) {
    return Number.POSITIVE_INFINITY;
  }

  return distance / Number(selected.coverageRadius);
}

export function guaranteedFoliageCoverageRadius(cluster) {
  if (Number.isFinite(cluster.alphaCoverageRadius)) {
    return Math.max(0, Number(cluster.alphaCoverageRadius));
  }

  const hasAlphaProfile =
    Number(cluster.cardWidth) > 0 &&
    typeof cluster.leafShape === 'string' &&
    Number.isFinite(Number(cluster.alphaTest)) &&
    Number.isSafeInteger(Number(cluster.planesPerCluster));
  if (!hasAlphaProfile) return Number(cluster.coverageRadius);

  return Number(cluster.cardWidth) * coverageProfile(cluster).guaranteedRadiusRatio;
}
