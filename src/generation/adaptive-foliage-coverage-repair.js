import { createFoliageCoverageCertificationIndex } from './foliage-coverage-certification-index.js';
import { analyzeFoliageCoveragePatch } from './foliage-coverage-patch-analysis.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import {
  buildExposureNeighborhoods,
  calculateExposureLipschitz,
  prepareExposureLobes,
} from './lobe-exposure.js';
import {
  createIcosahedronDirectionTriangles,
  subdivideDirectionTriangle,
} from './surface-direction-triangulation.js';

const DIRECTION_KEY_SCALE = 1e6;

function validateOptions(options) {
  const finiteNonNegative = [
    ['stopCoverageRatio', options.stopCoverageRatio],
    ['exposureThreshold', options.exposureThreshold],
    ['minimumDirectionDiameter', options.minimumDirectionDiameter],
    ['normalUncertaintyScale', options.normalUncertaintyScale],
  ];

  for (const [name, value] of finiteNonNegative) {
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`Adaptive foliage coverage ${name} is invalid.`);
    }
  }
  if (
    !Number.isSafeInteger(options.maximumSubdivisionDepth) ||
    options.maximumSubdivisionDepth < 0
  ) {
    throw new RangeError(
      'Adaptive foliage coverage maximumSubdivisionDepth must be non-negative.',
    );
  }
  if (
    !Number.isSafeInteger(options.maximumHolesPerLobe) ||
    options.maximumHolesPerLobe < 1
  ) {
    throw new RangeError(
      'Adaptive foliage coverage maximumHolesPerLobe must be positive.',
    );
  }
}

function directionKey(lobeId, direction) {
  const x = Math.round(direction.x * DIRECTION_KEY_SCALE);
  const y = Math.round(direction.y * DIRECTION_KEY_SCALE);
  const z = Math.round(direction.z * DIRECTION_KEY_SCALE);
  return `${lobeId}:${x}:${y}:${z}`;
}

function compareHoles(left, right) {
  const leftCoverage = Number(left.coverageRatio);
  const rightCoverage = Number(right.coverageRatio);
  if (leftCoverage !== rightCoverage) {
    if (leftCoverage === Number.POSITIVE_INFINITY) return -1;
    if (rightCoverage === Number.POSITIVE_INFINITY) return 1;
    return rightCoverage - leftCoverage;
  }
  return (
    left.depth - right.depth ||
    left.direction.x - right.direction.x ||
    left.direction.y - right.direction.y ||
    left.direction.z - right.direction.z
  );
}

function retainWorstHole(holes, hole, maximumCount) {
  holes.push(hole);
  holes.sort(compareHoles);
  if (holes.length > maximumCount) holes.pop();
}

function retainPatchHoles(holes, seenDirections, lobe, patch, depth, maximumCount) {
  let maximumCoverageRatio = 0;

  for (const hole of patch.holes) {
    maximumCoverageRatio = Math.max(maximumCoverageRatio, hole.coverageRatio);
    const key = directionKey(lobe.id, hole.direction);
    if (seenDirections.has(key)) continue;
    seenDirections.add(key);
    retainWorstHole(
      holes,
      Object.freeze({
        lobeId: lobe.id,
        direction: Object.freeze({ ...hole.direction }),
        coverageRatio: hole.coverageRatio,
        exposure: hole.exposure,
        kind: 'witnessed',
        depth,
      }),
      maximumCount,
    );
  }

  return maximumCoverageRatio;
}

function inspectLobe(index, lobe, lobes, options, exposureContext) {
  const stack = createIcosahedronDirectionTriangles()
    .reverse()
    .map((triangle) => ({ triangle, depth: 0 }));
  const holes = [];
  const seenDirections = new Set();
  let trianglesVisited = 0;
  let certifiedTriangleCount = 0;
  let unresolvedTriangleCount = 0;
  let maximumDepthReached = 0;
  let maximumCoverageRatio = 0;

  while (stack.length > 0) {
    const { triangle, depth } = stack.pop();
    trianglesVisited += 1;
    maximumDepthReached = Math.max(maximumDepthReached, depth);

    const patch = analyzeFoliageCoveragePatch(
      index,
      lobe,
      lobes,
      triangle,
      options,
      exposureContext,
    );
    if (patch.status === 'hidden') continue;

    if (patch.status === 'covered') {
      certifiedTriangleCount += 1;
      maximumCoverageRatio = Math.max(
        maximumCoverageRatio,
        patch.coverageRatio,
      );
      continue;
    }

    if (patch.status === 'holes') {
      maximumCoverageRatio = Math.max(
        maximumCoverageRatio,
        retainPatchHoles(
          holes,
          seenDirections,
          lobe,
          patch,
          depth,
          options.maximumHolesPerLobe,
        ),
      );
      continue;
    }

    const terminal =
      depth >= options.maximumSubdivisionDepth ||
      patch.directionDiameter <= options.minimumDirectionDiameter;
    if (terminal) {
      unresolvedTriangleCount += 1;
      const unresolvedRatio =
        options.stopCoverageRatio + FOLIAGE_SHELL_CONSTANTS.coverageRatioEpsilon;
      maximumCoverageRatio = Math.max(maximumCoverageRatio, unresolvedRatio);

      if (patch.fallback) {
        const key = directionKey(lobe.id, patch.fallback.direction);
        if (!seenDirections.has(key)) {
          seenDirections.add(key);
          retainWorstHole(
            holes,
            Object.freeze({
              lobeId: lobe.id,
              direction: Object.freeze({ ...patch.fallback.direction }),
              coverageRatio: unresolvedRatio,
              exposure: patch.fallback.exposure,
              kind: 'uncertified',
              depth,
            }),
            options.maximumHolesPerLobe,
          );
        }
      }
      continue;
    }

    const children = patch.children ?? subdivideDirectionTriangle(triangle);
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({ triangle: children[childIndex], depth: depth + 1 });
    }
  }

  return {
    holes,
    trianglesVisited,
    certifiedTriangleCount,
    unresolvedTriangleCount,
    maximumDepthReached,
    maximumCoverageRatio,
  };
}

function isPreparedExposureLobe(lobe) {
  return (
    Number.isFinite(lobe?.boundingRadius) &&
    Number.isFinite(lobe?.minimumRadius) &&
    lobe?.exposureTransform
  );
}

function createExposureContext(lobe, neighborhoods) {
  const lobes = neighborhoods.get(lobe.id) ?? [];
  return Object.freeze({
    lobes,
    lipschitz: calculateExposureLipschitz(lobes, lobe.id),
  });
}

export function inspectAdaptiveFoliageCoverage(selected, lobes, options) {
  if (!Array.isArray(selected) || !Array.isArray(lobes)) {
    throw new TypeError('Adaptive foliage coverage requires arrays.');
  }
  validateOptions(options);

  const index = createFoliageCoverageCertificationIndex(selected);
  const preparedExposureLobes = lobes.every(isPreparedExposureLobe)
    ? lobes
    : prepareExposureLobes(lobes);
  const exposureNeighborhoods = buildExposureNeighborhoods(preparedExposureLobes);
  const holes = [];
  let trianglesVisited = 0;
  let certifiedTriangleCount = 0;
  let unresolvedTriangleCount = 0;
  let maximumDepthReached = 0;
  let maximumCoverageRatio = 0;

  for (const lobe of lobes) {
    const result = inspectLobe(
      index,
      lobe,
      lobes,
      options,
      createExposureContext(lobe, exposureNeighborhoods),
    );
    holes.push(...result.holes);
    trianglesVisited += result.trianglesVisited;
    certifiedTriangleCount += result.certifiedTriangleCount;
    unresolvedTriangleCount += result.unresolvedTriangleCount;
    maximumDepthReached = Math.max(maximumDepthReached, result.maximumDepthReached);
    maximumCoverageRatio = Math.max(
      maximumCoverageRatio,
      result.maximumCoverageRatio,
    );
  }

  holes.sort(
    (left, right) =>
      left.lobeId - right.lobeId || compareHoles(left, right),
  );

  return Object.freeze({
    holes: Object.freeze(holes),
    trianglesVisited,
    certifiedTriangleCount,
    unresolvedTriangleCount,
    maximumDepthReached,
    maximumCoverageRatio,
  });
}
