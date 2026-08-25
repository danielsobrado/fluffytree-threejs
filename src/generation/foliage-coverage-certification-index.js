import {
  foliageCardCoverageRatio,
  guaranteedFoliageCoverageRadius,
} from './foliage-card-coverage.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { SpatialHashGrid } from './spatial-hash-grid.js';

const MAXIMUM_GRID_QUERY_RINGS = 8;

function distance(left, right) {
  return Math.hypot(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z,
  );
}

function normalDot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function visitNearbyRecords(index, position, radius, visitor) {
  if (index.records.length === 0) return;

  const rings = Math.max(1, Math.ceil(radius / index.grid.cellSize) + 1);
  if (rings > MAXIMUM_GRID_QUERY_RINGS) {
    for (const record of index.records) visitor(record);
    return;
  }

  index.grid.forEachNear(position, rings, (record) => {
    visitor(record);
    return false;
  });
}

function clusterCoverageUpperBound(
  record,
  samples,
  worldUncertainty,
  normalUncertainty,
  minimumCoverageNormalDot,
) {
  if (!(record.guaranteedCoverageRadius > 0)) {
    return Number.POSITIVE_INFINITY;
  }

  let minimumDot;
  let maximumSampleDistance;
  if (samples.normals.length === 1 && samples.positions.length === 1) {
    minimumDot = normalDot(samples.normals[0], record.cluster.normal);
    maximumSampleDistance = distance(samples.positions[0], record.cluster.position);
  } else {
    minimumDot = Number.POSITIVE_INFINITY;
    for (const normal of samples.normals) {
      minimumDot = Math.min(minimumDot, normalDot(normal, record.cluster.normal));
    }
    maximumSampleDistance = 0;
    for (const position of samples.positions) {
      maximumSampleDistance = Math.max(
        maximumSampleDistance,
        distance(position, record.cluster.position),
      );
    }
  }

  const normalDotLowerBound = Math.max(-1, minimumDot - normalUncertainty);
  if (normalDotLowerBound < minimumCoverageNormalDot) {
    return Number.POSITIVE_INFINITY;
  }

  return (
    (maximumSampleDistance + worldUncertainty) /
    record.guaranteedCoverageRadius
  );
}

function sampleCoverageRatio(record, position, normal, minimumCoverageNormalDot) {
  if (normalDot(normal, record.cluster.normal) < minimumCoverageNormalDot) {
    return Number.POSITIVE_INFINITY;
  }

  return foliageCardCoverageRatio(
    { position, surfacePoint: position, normal },
    record.cluster,
  );
}

export function createFoliageCoverageCertificationIndex(clusters) {
  const records = clusters.map((cluster) => ({
    cluster,
    coverageRadius: Number(cluster.coverageRadius),
    guaranteedCoverageRadius: guaranteedFoliageCoverageRadius(cluster),
  }));
  const maximumCoverageRadius = Math.max(
    0,
    ...records.map((record) => record.coverageRadius),
  );
  const maximumGuaranteedCoverageRadius = Math.max(
    0,
    ...records.map((record) => record.guaranteedCoverageRadius),
  );
  const grid = new SpatialHashGrid(
    Math.max(maximumCoverageRadius, FOLIAGE_SHELL_CONSTANTS.minimumCellSize),
  );

  for (const record of records) {
    if (!(record.coverageRadius > 0)) {
      throw new RangeError(
        'Foliage coverage certification requires positive coverage radii.',
      );
    }
    grid.insert(record.cluster.position, record);
  }

  return Object.freeze({
    records: Object.freeze(records),
    maximumCoverageRadius,
    maximumGuaranteedCoverageRadius,
    grid,
  });
}

export function findTriangleCoverageUpperBound(
  index,
  samples,
  {
    worldUncertainty,
    normalUncertainty,
    minimumCoverageNormalDot,
    targetRatio,
  },
) {
  if (index.records.length === 0) return Number.POSITIVE_INFINITY;

  const center = samples.positions.at(-1);
  const queryRadius =
    index.maximumGuaranteedCoverageRadius * targetRatio + worldUncertainty;
  let best = Number.POSITIVE_INFINITY;

  visitNearbyRecords(index, center, queryRadius, (record) => {
    best = Math.min(
      best,
      clusterCoverageUpperBound(
        record,
        samples,
        worldUncertainty,
        normalUncertainty,
        minimumCoverageNormalDot,
      ),
    );
  });

  return best;
}

export function findSampleCoverageRatio(
  index,
  position,
  normal,
  { minimumCoverageNormalDot, targetRatio },
) {
  if (index.records.length === 0) return Number.POSITIVE_INFINITY;

  const queryRadius = index.maximumCoverageRadius * targetRatio;
  let best = Number.POSITIVE_INFINITY;

  visitNearbyRecords(index, position, queryRadius, (record) => {
    best = Math.min(
      best,
      sampleCoverageRatio(
        record,
        position,
        normal,
        minimumCoverageNormalDot,
      ),
    );
  });

  return best;
}
