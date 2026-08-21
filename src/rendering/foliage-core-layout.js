import { resolveFoliageContinuityProfile } from '../domain/foliage-continuity-config.js?v=2.0.0-20260814.2';

const MINIMUM_BRIDGE_RADIUS = 0.02;

class DisjointSet {
  constructor(ids) {
    this.parent = new Map(ids.map((id) => [id, id]));
  }

  find(id) {
    const parent = this.parent.get(id);
    if (parent === undefined) return null;
    if (parent === id) return id;
    const root = this.find(parent);
    this.parent.set(id, root);
    return root;
  }

  union(left, right) {
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot === null || rightRoot === null || leftRoot === rightRoot) return false;
    this.parent.set(rightRoot, leftRoot);
    return true;
  }
}

function freezeVector(vector) {
  return Object.freeze({ x: vector.x, y: vector.y, z: vector.z });
}

function midpoint(left, right) {
  return {
    x: (left.x + right.x) * 0.5,
    y: (left.y + right.y) * 0.5,
    z: (left.z + right.z) * 0.5,
  };
}

function scaledPoint(position, direction, distance) {
  return {
    x: position.x + direction.x * distance,
    y: position.y + direction.y * distance,
    z: position.z + direction.z * distance,
  };
}

function createLobeInstance(treeData, lobe, effectiveCoreScale) {
  return Object.freeze({
    kind: 'lobe',
    sourceId: lobe.id,
    position: freezeVector(lobe.position),
    rotation: Object.freeze({ ...lobe.rotation }),
    scale: Object.freeze({
      x: lobe.scale.x * effectiveCoreScale,
      y: lobe.scale.y * effectiveCoreScale,
      z: lobe.scale.z * effectiveCoreScale,
    }),
    colorMix: lobe.colorMix,
    exposure: treeData.lobeExposure[lobe.id] ?? 1,
  });
}

function connectionScore(connection, policy) {
  return (
    connection.overlapRatio -
    connection.verticalAlignment * policy.verticalBias -
    (connection.sameMacro ? 0.01 : 0)
  );
}

function selectBridgeConnections(treeData, policy, effectiveCoreScale) {
  if (!policy.lod || treeData.lobeConnections?.length === 0) return [];

  const allowed = (treeData.lobeConnections ?? []).filter(
    (connection) => !policy.sameMacroOnly || connection.sameMacro,
  );
  const disjointSet = new DisjointSet(treeData.lobes.map((lobe) => lobe.id));
  const overlapThreshold = Math.min(
    1,
    effectiveCoreScale * policy.coreOverlapSafety,
  );

  for (const connection of allowed) {
    if (connection.overlapRatio <= overlapThreshold) {
      disjointSet.union(connection.leftLobeId, connection.rightLobeId);
    }
  }

  return allowed
    .filter((connection) => connection.overlapRatio > overlapThreshold)
    .sort(
      (left, right) =>
        connectionScore(left, policy) - connectionScore(right, policy) ||
        left.leftLobeId - right.leftLobeId ||
        left.rightLobeId - right.rightLobeId,
    )
    .filter((connection) =>
      disjointSet.union(connection.leftLobeId, connection.rightLobeId),
    );
}

function createBridgeInstance(treeData, connection, policy, effectiveCoreScale) {
  const lobesById = new Map(treeData.lobes.map((lobe) => [lobe.id, lobe]));
  const left = lobesById.get(connection.leftLobeId);
  const right = lobesById.get(connection.rightLobeId);
  if (!left || !right) return null;

  const leftReach = connection.leftRadius * effectiveCoreScale;
  const rightReach = connection.rightRadius * effectiveCoreScale;
  const leftBoundary = scaledPoint(left.position, connection.direction, leftReach);
  const rightBoundary = scaledPoint(right.position, connection.direction, -rightReach);
  const crossRadius = Math.max(
    MINIMUM_BRIDGE_RADIUS,
    Math.min(connection.leftRadius, connection.rightRadius) *
      effectiveCoreScale *
      policy.bridgeRadiusRatio,
  );
  const boundaryDistance = Math.hypot(
    rightBoundary.x - leftBoundary.x,
    rightBoundary.y - leftBoundary.y,
    rightBoundary.z - leftBoundary.z,
  );
  const halfLength = Math.max(
    crossRadius,
    boundaryDistance * 0.5 +
      crossRadius * (1 + policy.bridgeLengthPaddingRatio),
  );
  const leftExposure = treeData.lobeExposure[left.id] ?? 1;
  const rightExposure = treeData.lobeExposure[right.id] ?? 1;

  return Object.freeze({
    kind: 'bridge',
    sourceId: `${left.id}:${right.id}`,
    position: freezeVector(midpoint(leftBoundary, rightBoundary)),
    direction: connection.direction,
    scale: Object.freeze({ x: crossRadius, y: halfLength, z: crossRadius }),
    colorMix: (left.colorMix + right.colorMix) * 0.5,
    exposure: Math.min(leftExposure, rightExposure) * 0.35,
  });
}

export function createFoliageCoreLayout(
  treeData,
  { lodIndex = 0, scaleMultiplier = 1 } = {},
) {
  if (!Number.isInteger(lodIndex) || lodIndex < 0 || lodIndex > 2) {
    throw new RangeError(`Foliage core LOD index must be 0, 1 or 2; received ${lodIndex}.`);
  }
  if (!Number.isFinite(scaleMultiplier) || scaleMultiplier <= 0) {
    throw new RangeError('Foliage core scale multiplier must be positive.');
  }

  const policy = resolveFoliageContinuityProfile(
    treeData.continuity,
    treeData.crownProfile,
  );
  const lodPolicy = policy.lod[lodIndex];
  const effectiveCoreScale =
    treeData.palette.core.scale * scaleMultiplier * lodPolicy.coreScale;
  const lobeInstances = treeData.lobes.map((lobe) =>
    createLobeInstance(treeData, lobe, effectiveCoreScale),
  );
  const bridgeConnections = lodPolicy.bridges
    ? selectBridgeConnections(treeData, policy, effectiveCoreScale)
    : [];
  const bridgeInstances = bridgeConnections
    .map((connection) =>
      createBridgeInstance(treeData, connection, policy, effectiveCoreScale),
    )
    .filter(Boolean);

  return Object.freeze({
    instances: Object.freeze([...lobeInstances, ...bridgeInstances]),
    lobeInstanceCount: lobeInstances.length,
    bridgeInstanceCount: bridgeInstances.length,
    effectiveCoreScale,
    profile: policy.profile,
  });
}
