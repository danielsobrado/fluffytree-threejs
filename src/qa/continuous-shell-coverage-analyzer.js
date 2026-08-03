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
import {
  createIcosahedronDirectionTriangles,
  directionTriangleCentroid,
  directionTriangleDiameter,
  subdivideDirectionTriangle,
} from './ellipsoid-surface-triangulation.js';
import {
  createShellCoverageClusterIndex,
  findTriangleCoverageUpperBound,
} from './shell-coverage-cluster-index.js';

function createTriangleSamples(lobe, triangle) {
  const directions = [
    triangle.a,
    triangle.b,
    triangle.c,
    directionTriangleCentroid(triangle),
  ];

  return {
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
  const condition =
    maximumScale(lobe) / Math.max(minimumScale(lobe), Number.EPSILON);
  return Math.min(2, 2 * condition * directionDiameter * scale);
}

function maximumExposure(samples, lobes, ownerLobeId) {
  return Math.max(
    ...samples.positions.map((position) =>
      calculateLobeExposure(position, lobes, ownerLobeId),
    ),
  );
}

function validateOptions(options) {
  const checks = [
    ['maximumGapCardRatio', options.maximumGapCardRatio],
    ['maximumSubdivisionDepth', options.maximumSubdivisionDepth],
    ['minimumDirectionDiameter', options.minimumDirectionDiameter],
    ['exposureMargin', options.exposureMargin],
    ['normalUncertaintyScale', options.normalUncertaintyScale],
  ];

  for (const [name, value] of checks) {
    if (!Number.isFinite(value) || value < 0) {
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

function createFailureRecord(
  lobe,
  depth,
  directionDiameter,
  exposureUpperBound,
  gapCardRatioUpperBound,
  samples,
) {
  return Object.freeze({
    lobeId: lobe.id,
    depth,
    directionDiameter,
    exposureUpperBound,
    gapCardRatioUpperBound,
    position: samples.positions.at(-1),
  });
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
  const clusterIndex = createShellCoverageClusterIndex(tree.shell);
  const exposureThreshold = Math.min(
    1,
    preset.foliage.shell.exposureThreshold + options.exposureMargin,
  );
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

      if (exposureUpperBound < exposureThreshold) {
        hiddenTriangleCount += 1;
        continue;
      }

      const gapUpperBound = findTriangleCoverageUpperBound(
        clusterIndex,
        samples,
        {
          worldUncertainty,
          normalUncertainty: calculateNormalUncertainty(
            lobe,
            directionDiameter,
            options.normalUncertaintyScale,
          ),
          minimumCoverageNormalDot: options.minimumCoverageNormalDot,
          targetRatio: options.maximumGapCardRatio,
        },
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
      const failure = createFailureRecord(
        lobe,
        depth,
        directionDiameter,
        exposureUpperBound,
        gapUpperBound,
        samples,
      );
      if (
        !worst ||
        failure.gapCardRatioUpperBound > worst.gapCardRatioUpperBound
      ) {
        worst = failure;
      }
      if (failures.length < options.maximumFailureExamples) {
        failures.push(failure);
      }
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
