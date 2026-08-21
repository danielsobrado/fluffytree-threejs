import { FOLIAGE_SHELL_CONSTANTS } from '../generation/foliage-shell-constants.js?v=2.0.0-20260814.2';
import {
  calculateExposureLipschitz,
  calculateLobeExposure,
  prepareExposureLobes,
} from '../generation/lobe-exposure.js?v=2.0.0-20260814.2';
import {
  lobeSurfaceNormal,
  pointOnLobeSurface,
} from '../generation/lobe-geometry.js?v=2.0.0-20260814.2';
import {
  createIcosahedronDirectionTriangles,
  directionTriangleCentroid,
  directionTriangleDiameter,
  subdivideDirectionTriangle,
} from './ellipsoid-surface-triangulation.js?v=2.0.0-20260814.2';
import {
  createShellCoverageClusterIndex,
  findSampleCoverageRatio,
  findTriangleCoverageUpperBound,
} from './shell-coverage-cluster-index.js?v=2.0.0-20260814.2';

function createTriangleSamples(lobe, triangle) {
  const children = subdivideDirectionTriangle(triangle);
  const directions = [
    triangle.a,
    triangle.b,
    triangle.c,
    children[0].b,
    children[1].c,
    children[0].c,
    directionTriangleCentroid(triangle),
  ];

  return {
    positions: directions.map((direction) => pointOnLobeSurface(lobe, direction)),
    normals: directions.map((direction) => lobeSurfaceNormal(lobe, direction)),
    // The four midpoint children exactly tile the parent spherical triangle.
    // Every point in the parent is therefore within one child diameter of at
    // least one sampled child vertex.
    directionRadius: Math.max(
      ...children.map((child) => directionTriangleDiameter(child)),
    ),
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

function calculateSampleExposures(samples, lobes, ownerLobeId) {
  return samples.positions.map((position) =>
    calculateLobeExposure(position, lobes, ownerLobeId),
  );
}

function validateOptions(options) {
  const checks = [
    ['maximumCoverageRatio', options.maximumCoverageRatio],
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
  coverageRatioUpperBound,
  samples,
  kind,
) {
  return Object.freeze({
    kind,
    lobeId: lobe.id,
    depth,
    directionDiameter,
    exposureUpperBound,
    coverageRatioUpperBound,
    position: samples.positions.at(-1),
  });
}

export function analyzeContinuousShellCoverage(tree, preset, overrides = {}) {
  const options = {
    maximumCoverageRatio: 1,
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
  let maximumCoverageRatioUpperBound = 0;
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
      const samples = createTriangleSamples(lobe, triangle);
      const worldUncertainty = maximumScale(lobe) * samples.directionRadius;
      const sampleExposures = calculateSampleExposures(
        samples,
        lobes,
        lobe.id,
      );
      const exposureUpperBound = Math.min(
        1,
        Math.max(...sampleExposures) +
          exposureLipschitz * worldUncertainty,
      );

      if (exposureUpperBound < exposureThreshold) {
        hiddenTriangleCount += 1;
        continue;
      }

      const potentiallyExposedThreshold =
        exposureThreshold - exposureLipschitz * worldUncertainty;
      const normalUncertainty = calculateNormalUncertainty(
        lobe,
        samples.directionRadius,
        options.normalUncertaintyScale,
      );
      let coverageUpperBound = 0;

      for (let index = 0; index < samples.positions.length; index += 1) {
        if (sampleExposures[index] < potentiallyExposedThreshold) continue;

        const sampleCoverageUpperBound = findTriangleCoverageUpperBound(
          clusterIndex,
          {
            positions: [samples.positions[index]],
            normals: [samples.normals[index]],
          },
          {
            worldUncertainty,
            normalUncertainty,
            minimumCoverageNormalDot: options.minimumCoverageNormalDot,
            targetRatio: options.maximumCoverageRatio,
          },
        );
        coverageUpperBound = Math.max(
          coverageUpperBound,
          sampleCoverageUpperBound,
        );
        if (coverageUpperBound > options.maximumCoverageRatio) break;
      }

      if (coverageUpperBound <= options.maximumCoverageRatio) {
        coveredTriangleCount += 1;
        maximumCoverageRatioUpperBound = Math.max(
          maximumCoverageRatioUpperBound,
          coverageUpperBound,
        );
        continue;
      }

      for (let index = 0; index < samples.positions.length; index += 1) {
        if (sampleExposures[index] < exposureThreshold) continue;

        const coverageRatio = findSampleCoverageRatio(
          clusterIndex,
          samples.positions[index],
          samples.normals[index],
          {
            minimumCoverageNormalDot: options.minimumCoverageNormalDot,
            targetRatio: options.maximumCoverageRatio,
          },
        );
        if (coverageRatio <= options.maximumCoverageRatio) continue;

        uncoveredTriangleCount += 1;
        maximumCoverageRatioUpperBound = Number.POSITIVE_INFINITY;
        const failure = createFailureRecord(
          lobe,
          depth,
          directionDiameter,
          sampleExposures[index],
          coverageRatio,
          { positions: [samples.positions[index]] },
          'sample',
        );
        worst = failure;
        if (failures.length < options.maximumFailureExamples) {
          failures.push(failure);
        }

        return Object.freeze({
          passed: false,
          maximumCoverageRatio: options.maximumCoverageRatio,
          maximumCoverageRatioUpperBound,
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
      maximumCoverageRatioUpperBound = Number.POSITIVE_INFINITY;
      const failure = createFailureRecord(
        lobe,
        depth,
        directionDiameter,
        exposureUpperBound,
        coverageUpperBound,
        samples,
        'unresolved',
      );
      if (
        !worst ||
        failure.coverageRatioUpperBound > worst.coverageRatioUpperBound
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
    maximumCoverageRatio: options.maximumCoverageRatio,
    maximumCoverageRatioUpperBound,
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
