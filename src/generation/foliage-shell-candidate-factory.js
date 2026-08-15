import { createFoliageCardSizing } from './foliage-card-sizing.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import {
  calculateLobeClearance,
  clearanceToExposure,
} from './lobe-exposure.js';
import {
  lobeSurfaceNormal,
  normalizeVector,
  pointOnLobeSurface,
} from './lobe-geometry.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function averageScale(lobe) {
  return (lobe.scale.x + lobe.scale.y + lobe.scale.z) / 3;
}

function normalDot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function calculateFoliageCrownCenter(lobes) {
  let x = 0;
  let y = 0;
  let z = 0;

  for (const lobe of lobes) {
    x += lobe.position.x;
    y += lobe.position.y;
    z += lobe.position.z;
  }

  return {
    x: x / lobes.length,
    y: y / lobes.length,
    z: z / lobes.length,
  };
}

export function createFibonacciDirection(index, count, phase) {
  const y = 1 - 2 * ((index + 0.5) / count);
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * FOLIAGE_SHELL_CONSTANTS.goldenAngle + phase;

  return {
    x: Math.cos(angle) * radius,
    y,
    z: Math.sin(angle) * radius,
  };
}

export function createFoliageShellCandidate(
  lobe,
  direction,
  lobes,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  random,
  candidateIndex,
) {
  const surfacePoint = pointOnLobeSurface(lobe, direction);
  const normal = lobeSurfaceNormal(lobe, direction);
  const meanScale = averageScale(lobe);
  const radialOffset = meanScale * settings.radialOffsetRatio;
  const position = {
    x: surfacePoint.x + normal.x * radialOffset,
    y: surfacePoint.y + normal.y * radialOffset,
    z: surfacePoint.z + normal.z * radialOffset,
  };
  const clearance = calculateLobeClearance(surfacePoint, lobes, lobe.id);
  const exposure = clearanceToExposure(clearance);
  const outward = normalizeVector({
    x: surfacePoint.x - crownCenter.x,
    y: surfacePoint.y - crownCenter.y,
    z: surfacePoint.z - crownCenter.z,
  });
  const outwardAlignment = clamp01(
    (normalDot(normal, outward) + FOLIAGE_SHELL_CONSTANTS.outwardBias) /
      FOLIAGE_SHELL_CONSTANTS.outwardRange,
  );
  const upwardAlignment = clamp01(normal.y * 0.5 + 0.5);
  const score =
    exposure * FOLIAGE_SHELL_CONSTANTS.exposureWeight +
    outwardAlignment * FOLIAGE_SHELL_CONSTANTS.outwardWeight +
    upwardAlignment * FOLIAGE_SHELL_CONSTANTS.upwardWeight +
    random.next() * FOLIAGE_SHELL_CONSTANTS.scoreJitter;
  const sizing = createFoliageCardSizing(
    meanScale,
    settings,
    maximumCardWidthSpread,
    random,
  );
  const outwardRatio = random.range(
    settings.outwardRatio[0],
    settings.outwardRatio[1],
  );

  return {
    candidateIndex,
    lobeId: lobe.id,
    surfacePoint,
    position,
    normal,
    exposure,
    clearance,
    score,
    scale: sizing.scale,
    shellScale: sizing.shellScale,
    widthRatio: sizing.widthRatio,
    outwardRatio,
    cardWidth: sizing.cardWidth,
    coverageRadius: sizing.coverageRadius,
    alphaCoverageRadius:
      sizing.cardWidth * alphaProfile.guaranteedRadiusRatio,
    alphaProfile,
    leafShape: alphaProfile.shapeId,
    alphaTest: alphaProfile.alphaTest,
    planesPerCluster: alphaProfile.planesPerCluster,
    rotation: random.range(0, FOLIAGE_SHELL_CONSTANTS.tau),
    colorMix: clamp01(lobe.colorMix + random.signed() * settings.colorJitter),
    windPhase: random.range(0, FOLIAGE_SHELL_CONSTANTS.tau),
  };
}
