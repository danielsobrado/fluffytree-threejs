import { FOLIAGE_SHELL_CONSTANTS } from '../generation/foliage-shell-constants.js';
import {
  calculateExposureLipschitz,
  calculateLobeExposure,
  prepareExposureLobes,
} from '../generation/lobe-exposure.js';
import {
  lobeSurfaceNormal,
  pointOnLobeSurface,
} from '../generation/lobe-geometry.js';
import { SpatialHashGrid } from '../generation/spatial-hash-grid.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js';
import {
  createIcosahedronDirectionTriangles,
  directionTriangleCentroid,
  directionTriangleDiameter,
  subdivideDirectionTriangle,
} from './ellipsoid-surface-triangulation.js';

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

function cardWidth(cluster) {
  const explicit = Number(cluster.cardWidth);
  if (explicit > 0) return explicit;
  return (
    Number(cluster.scale) *
    Number(cluster.widthRatio) *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier
  );
}

function createClusterIndex(clusters) {
  const records = clusters.map((cluster) => ({
    cluster,
    width: cardWidth(cluster),
  }));
  const maximumWidth = Math.max(0, ...records.map((record) => record.width));
  const grid = new SpatialHashGrid(
    Math.max(maximumWidth, FOLIAGE_SHELL_CONSTANTS.minimumCellSize),
  );

  for (const record of records) {
    if (!(record.width > 0)) {
      throw new RangeError('Continuous shell coverage requires positive card widths.');
    }
    grid.insert(record.cluster.position, record);
  }

  return { records, maximumWidth, grid };
}

function collectNearbyClusters(index, position, radius) {
  if (index.records.length === 0) return new Set();

  const rings = Math.max(1, Math.ceil(radius / index.grid.cellSize) + 1);
  if (rings > MAXIMUM_GRID_QUERY_RINGS) return new Set(index.records);

  const records = new Set();
  index.grid.forEachNear(position, rings, (record) => {
    records.add(record);
    return false;
  });
  return records;
}

function createTriangleSamples(lobe, triangle) {
  const directions = [
    triangle.a,
    triangle.b,
    triangle.c,
    directionTriangleCentroid(triangle),
  ];

  return {
    directions,
    positions: directions.map((direction) => pointOnLobeSurface(lobe, direction)),
    normals: directions.map((direction) => lobeSurfaceNormal(lobe, direction)),
  };
}

function maximumScale(lobe) {
  return Math.max(lobe.scale.x, lobe.scale.y, lobe.scale.z);
}

function minimumScale(lobe) {
  return Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z);
}

function calculateNormalUncertainty(lobe, directionDiameter, scale) {
  const condition = maximumScale(lobe) / Math.max(minimumScale(lobe), Number.EPSILON);
  return Math.min(2, 2 * condition * directionDiameter * scale);
}

function maximumExposure(samples, lobes, ownerLobeId) {
  return Math.max(
    ...samples.positions.map((position) =>
      calculateLobeExposure(position, lobes, ownerLobeId),
    ),
  );
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
  return (maximumSampleDistance + worldUncertainty) / record.width;
}

function bestCoverageUpperBound(
  index,
  samples,
  worldUncertainty,
  normalUncertainty,
  minimumCoverageNormalDot,
  targetRatio,
) {
  if (index.records.length === 0) return Number.POSITIVE_INFINITY;

  const center = samples.positions.at(-1);
  const queryRadius = index.maximumWidth * targetRatio + worldUncertainty;
  const nearby = collectNearbyClusters(index, center, queryRadius);
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

function validateOptions(options) {
  const checks = [
    ['maximumGapCardRatio', options.maximumGapCardRatio, 0],
    ['maximumSubdivisionDepth', options.maximumSubdivisionDepth, 0],
    ['minimumDirectionDiameter', options.minimumDirectionDiameter, 0],
    ['exposureMargin', options.exposureMargin, 0],
    ['normalUncertaintyScale', options.normalUncertaintyScale, 0],
  ];

  for (const [name, value, minimum] of checks) {
    if (!Number.isFinite(value) || value < minimum) {
      throw new RangeError(`Continuous shell coverage ${name} is invalid.`);
    }
  }
  if (!Number.isSafeInteger(options.maximumSubdivisionDepth)) {
    throw new RangeError(
      'Continuous shell coverage maximumSubdivisionDepth must be an integer.',
    );
  }
  if (
    !Number.isSafeInteger(options.maximumFailureExamples) ||
    options.maximumFailureExamples < 0
  ) {
    throw new RangeError(
      'Continuous shell coverage maximumFailureExamples must be a non-negative integer.',
    );
  }
  if (
    !Number.isFinite(options.minimumCoverageNormalDot) ||
    options.minimumCoverageNormalDot < -1 ||
    options.minimumCoverageNormalDot > 1
  ) {
    throw new RangeError(
      'Continuous shell coverage minimumCoverageNormalDot must be within [-1, 1].',
    );
  }
}

export function analyzeContinuousShellCoverage(tree, preset, overrides = {}) {
  const options = {
    maximumGapCardRatio: 0.9,
    maximumSubdivisionDepth: 8,
    minimumDirectionDiameter: 0.006,
    exposureMargin: 0.05,
    normalUncertaintyScale: 1,
    minimumCoverageNormalDot:
      FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot,
    maximumFailureExamples: 12,
    ...overrides,
  };
  validateOptions(options);

  const lobes = prepareExposureLobes(tree.lobes);
  const index = createClusterIndex(tree.shell);
  const threshold = preset.foliage.shell.exposureThreshold + options.exposureMargin;
  const failures = [];
  let trianglesVisited = 0;
  let hiddenTriangleCount = 0;
  let coveredTriangleCount = 0;
  let uncoveredTriangleCount = 0;
  let subdivisionCount = 0;
  let maximumDepthReached = 0;
  let maximumGapCardRatioUpperBound = 0;
  let worst = null;

  for (const lobe of lobes) {
    const exposureLipschitz = calculateExposureLipschitz(lobes, lobe.id);
    const stack = createIcosahedronDirectionTriangles().map((triangle) => ({
      triangle,
      depth: 0,
    }));

    while (stack.length > 0) {
      const { triangle, depth } = stack.pop();
      trianglesVisited += 1;
      maximumDepthReached = Math.max(maximumDepthReached, depth);

      const directionDiameter = directionTriangleDiameter(triangle);
      const worldUncertainty = maximumScale(lobe) * directionDiameter;
      const samples = createTriangleSamples(lobe, triangle);
      const exposureUpperBound = Math.min(
        1,
        maximumExposure(samples, lobes, lobe.id) +
          exposureLipschitz * worldUncertainty,
      );

      if (exposureUpperBound < threshold) {
        hiddenTriangleCount += 1;
        continue;
      }

      const normalUncertainty = calculateNormalUncertainty(
        lobe,
        directionDiameter,
        options.normalUncertaintyScale,
      );
      const gapUpperBound = bestCoverageUpperBound(
        index,
        samples,
        worldUncertainty,
        normalUncertainty,
        options.minimumCoverageNormalDot,
        options.maximumGapCardRatio,
      );

      if (gapUpperBound <= options.maximumGapCardRatio) {
        coveredTriangleCount += 1;
        maximumGapCardRatioUpperBound = Math.max(
          maximumGapCardRatioUpperBound,
          gapUpperBound,
        );
        continue;
      }

      const terminal =
        depth >= options.maximumSubdivisionDepth ||
        directionDiameter <= options.minimumDirectionDiameter;
      if (!terminal) {
        subdivisionCount += 1;
        for (const child of subdivideDirectionTriangle(triangle)) {
          stack.push({ triangle: child, depth: depth + 1 });
        }
        continue;
      }

      uncoveredTriangleCount += 1;
      maximumGapCardRatioUpperBound = Number.POSITIVE_INFINITY;
      const record = {
        lobeId: lobe.id,
        depth,
        directionDiameter,
        exposureUpperBound,
        gapCardRatioUpperBound: gapUpperBound,
        position: samples.positions.at(-1),
      };
      if (
        !worst ||
        record.gapCardRatioUpperBound > worst.gapCardRatioUpperBound
      ) {
        worst = record;
      }
      if (failures.length < options.maximumFailureExamples) failures.push(record);
    }
  }

  return Object.freeze({
    passed: uncoveredTriangleCount === 0,
    maximumGapCardRatio: options.maximumGapCardRatio,
    maximumGapCardRatioUpperBound,
    trianglesVisited,
    hiddenTriangleCount,
    coveredTriangleCount,
    uncoveredTriangleCount,
    subdivisionCount,
    maximumDepthReached,
    worst,
    failures: Object.freeze(failures),
  });
}
