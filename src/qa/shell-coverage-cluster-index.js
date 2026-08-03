import { FOLIAGE_SHELL_CONSTANTS } from '../generation/foliage-shell-constants.js';
import { SpatialHashGrid } from '../generation/spatial-hash-grid.js';

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

function collectNearbyRecords(index, position, radius) {
  if (index.records.length === 0) return [];

  const rings = Math.max(1, Math.ceil(radius / index.grid.cellSize) + 1);
  if (rings > MAXIMUM_GRID_QUERY_RINGS) return index.records;

  const records = [];
  index.grid.forEachNear(position, rings, (record) => {
    records.push(record);
    return false;
  });
  return records;
}

function clusterCoverageUpperBound(
  record,
  samples,
  worldUncertainty,
  normalUncertainty,
  minimumCoverageNormalDot,
) {
  const minimumDot = Math.min(
    ...samples.normals.map((normal) => normalDot(normal, record.cluster.normal)),
  );
  if (minimumDot - normalUncertainty < minimumCoverageNormalDot) {
    return Number.POSITIVE_INFINITY;
  }

  const maximumSampleDistance = Math.max(
    ...samples.positions.map((position) =>
      distance(position, record.cluster.position),
    ),
  );
  return (maximumSampleDistance + worldUncertainty) / record.coverageRadius;
}

export function createShellCoverageClusterIndex(clusters) {
  const records = clusters.map((cluster) => ({
    cluster,
    coverageRadius: Number(cluster.coverageRadius),
  }));
  const maximumCoverageRadius = Math.max(
    0,
    ...records.map((record) => record.coverageRadius),
  );
  const grid = new SpatialHashGrid(
    Math.max(
      maximumCoverageRadius,
      FOLIAGE_SHELL_CONSTANTS.minimumCellSize,
    ),
  );

  for (const record of records) {
    if (!(record.coverageRadius > 0)) {
      throw new RangeError(
        'Continuous shell coverage requires positive coverage radii.',
      );
    }
    grid.insert(record.cluster.position, record);
  }

  return Object.freeze({
    records: Object.freeze(records),
    maximumCoverageRadius,
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
    index.maximumCoverageRadius * targetRatio + worldUncertainty;
  const nearby = collectNearbyRecords(index, center, queryRadius);
  let best = Number.POSITIVE_INFINITY;

  for (const record of nearby) {
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
  }

  return best;
}
