import {
  findSampleCoverageRatio,
  findTriangleCoverageUpperBound,
} from './foliage-coverage-certification-index.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import {
  calculateExposureLipschitz,
  calculateLobeExposure,
} from './lobe-exposure.js';
import {
  lobeSurfaceNormal,
  pointOnLobeSurface,
} from './lobe-geometry.js';
import {
  directionTriangleCentroid,
  directionTriangleDiameter,
  subdivideDirectionTriangle,
} from './surface-direction-triangulation.js';

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
    children,
    directions,
    positions: directions.map((direction) => pointOnLobeSurface(lobe, direction)),
    directionRadius: Math.max(
      ...children.map((child) => directionTriangleDiameter(child)),
    ),
  };
}

function populateNormals(samples, lobe) {
  samples.normals = samples.directions.map((direction) =>
    lobeSurfaceNormal(lobe, direction),
  );
}

function findCoverageUpperBound(
  index,
  lobe,
  samples,
  sampleExposures,
  exposureLipschitz,
  options,
) {
  const worldUncertainty = maximumScale(lobe) * samples.directionRadius;
  const potentiallyExposedThreshold =
    options.exposureThreshold - exposureLipschitz * worldUncertainty;
  const normalUncertainty = calculateNormalUncertainty(
    lobe,
    samples.directionRadius,
    options.normalUncertaintyScale,
  );
  let coverageUpperBound = 0;

  for (let sampleIndex = 0; sampleIndex < samples.positions.length; sampleIndex += 1) {
    if (sampleExposures[sampleIndex] < potentiallyExposedThreshold) continue;

    const sampleUpperBound = findTriangleCoverageUpperBound(
      index,
      {
        positions: [samples.positions[sampleIndex]],
        normals: [samples.normals[sampleIndex]],
      },
      {
        worldUncertainty,
        normalUncertainty,
        minimumCoverageNormalDot: FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot,
        targetRatio: options.stopCoverageRatio,
      },
    );
    coverageUpperBound = Math.max(coverageUpperBound, sampleUpperBound);
    if (coverageUpperBound > options.stopCoverageRatio) break;
  }

  return { coverageUpperBound, worldUncertainty };
}

function findWitnessedHoles(index, samples, sampleExposures, options) {
  const holes = [];

  for (let sampleIndex = 0; sampleIndex < samples.positions.length; sampleIndex += 1) {
    if (sampleExposures[sampleIndex] < options.exposureThreshold) continue;

    const coverageRatio = findSampleCoverageRatio(
      index,
      samples.positions[sampleIndex],
      samples.normals[sampleIndex],
      {
        minimumCoverageNormalDot: FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot,
        targetRatio: options.stopCoverageRatio,
      },
    );
    if (coverageRatio <= options.stopCoverageRatio) continue;

    holes.push({
      direction: samples.directions[sampleIndex],
      coverageRatio,
      exposure: sampleExposures[sampleIndex],
    });
  }

  return holes;
}

function resolveExposureContext(lobe, lobes, context) {
  const exposureLobes = context?.lobes ?? lobes;
  const exposureLipschitz =
    context?.lipschitz ?? calculateExposureLipschitz(exposureLobes, lobe.id);
  return { exposureLobes, exposureLipschitz };
}

export function analyzeFoliageCoveragePatch(
  index,
  lobe,
  lobes,
  triangle,
  options,
  exposureContext = null,
) {
  const samples = createTriangleSamples(lobe, triangle);
  const { exposureLobes, exposureLipschitz } = resolveExposureContext(
    lobe,
    lobes,
    exposureContext,
  );
  const sampleExposures = samples.positions.map((position) =>
    calculateLobeExposure(position, exposureLobes, lobe.id),
  );
  const worldUncertainty = maximumScale(lobe) * samples.directionRadius;
  const exposureUpperBound = Math.min(
    1,
    Math.max(...sampleExposures) + exposureLipschitz * worldUncertainty,
  );

  if (exposureUpperBound < options.exposureThreshold) {
    return Object.freeze({ status: 'hidden' });
  }

  populateNormals(samples, lobe);
  const coverage = findCoverageUpperBound(
    index,
    lobe,
    samples,
    sampleExposures,
    exposureLipschitz,
    options,
  );
  if (coverage.coverageUpperBound <= options.stopCoverageRatio) {
    return Object.freeze({
      status: 'covered',
      coverageRatio: coverage.coverageUpperBound,
    });
  }

  const holes = findWitnessedHoles(index, samples, sampleExposures, options);
  if (holes.length > 0) {
    return Object.freeze({ status: 'holes', holes: Object.freeze(holes) });
  }

  let fallbackIndex = -1;
  for (let index = 0; index < sampleExposures.length; index += 1) {
    if (sampleExposures[index] < options.exposureThreshold) continue;
    if (
      fallbackIndex < 0 ||
      sampleExposures[index] > sampleExposures[fallbackIndex]
    ) {
      fallbackIndex = index;
    }
  }

  return Object.freeze({
    status: 'unresolved',
    directionDiameter: directionTriangleDiameter(triangle),
    children: Object.freeze(samples.children),
    fallback:
      fallbackIndex < 0
        ? null
        : Object.freeze({
            direction: samples.directions[fallbackIndex],
            exposure: sampleExposures[fallbackIndex],
          }),
  });
}
