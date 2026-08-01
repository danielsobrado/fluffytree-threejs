import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import {
  lobeSurfaceNormal,
  normalizeVector,
  normalizedRotatedPointDistance,
  pointOnLobeSurface,
} from './lobe-geometry.js';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function averageScale(lobe) {
  return (lobe.scale.x + lobe.scale.y + lobe.scale.z) / 3;
}

function calculateCrownCenter(lobes) {
  const total = lobes.reduce(
    (result, lobe) => ({
      x: result.x + lobe.position.x,
      y: result.y + lobe.position.y,
      z: result.z + lobe.position.z,
    }),
    { x: 0, y: 0, z: 0 },
  );

  return {
    x: total.x / lobes.length,
    y: total.y / lobes.length,
    z: total.z / lobes.length,
  };
}

function createFibonacciDirection(index, count, phase) {
  const y = 1 - 2 * ((index + 0.5) / count);
  const radius = Math.sqrt(Math.max(0, 1 - y * y));
  const angle = index * FOLIAGE_SHELL_CONSTANTS.goldenAngle + phase;

  return {
    x: Math.cos(angle) * radius,
    y,
    z: Math.sin(angle) * radius,
  };
}

function calculateClearance(point, lobes, ownerLobeId) {
  let minimum = Number.POSITIVE_INFINITY;

  for (const lobe of lobes) {
    if (lobe.id === ownerLobeId) continue;
    minimum = Math.min(
      minimum,
      normalizedRotatedPointDistance(point, lobe) - 1,
    );
  }

  return minimum === Number.POSITIVE_INFINITY ? 1 : minimum;
}

function calculateSeparation(candidate, selected) {
  if (selected.length === 0) return 1;

  let minimum = 1;
  for (const current of selected) {
    const dot =
      candidate.normal.x * current.normal.x +
      candidate.normal.y * current.normal.y +
      candidate.normal.z * current.normal.z;
    minimum = Math.min(minimum, clamp01((1 - dot) * 0.5));
  }

  return minimum;
}

function selectDistributedCandidates(candidates, count) {
  const remaining = [...candidates];
  const selected = [];

  while (selected.length < count && remaining.length > 0) {
    let bestIndex = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < remaining.length; index += 1) {
      const candidate = remaining[index];
      const score =
        candidate.score * FOLIAGE_SHELL_CONSTANTS.selectionScoreWeight +
        calculateSeparation(candidate, selected) *
          FOLIAGE_SHELL_CONSTANTS.selectionSeparationWeight;

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    selected.push(remaining.splice(bestIndex, 1)[0]);
  }

  return selected;
}

function createCandidate(
  lobe,
  direction,
  lobes,
  crownCenter,
  settings,
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
  const clearance = calculateClearance(surfacePoint, lobes, lobe.id);
  const exposure = clamp01(
    (clearance + FOLIAGE_SHELL_CONSTANTS.clearanceOffset) /
      FOLIAGE_SHELL_CONSTANTS.clearanceRange,
  );
  const outward = normalizeVector({
    x: surfacePoint.x - crownCenter.x,
    y: surfacePoint.y - crownCenter.y,
    z: surfacePoint.z - crownCenter.z,
  });
  const outwardAlignment = clamp01(
    (normal.x * outward.x +
      normal.y * outward.y +
      normal.z * outward.z +
      FOLIAGE_SHELL_CONSTANTS.outwardBias) /
      FOLIAGE_SHELL_CONSTANTS.outwardRange,
  );
  const upwardAlignment = clamp01(normal.y * 0.5 + 0.5);
  const score =
    exposure * FOLIAGE_SHELL_CONSTANTS.exposureWeight +
    outwardAlignment * FOLIAGE_SHELL_CONSTANTS.outwardWeight +
    upwardAlignment * FOLIAGE_SHELL_CONSTANTS.upwardWeight +
    random.next() * FOLIAGE_SHELL_CONSTANTS.scoreJitter;

  return {
    candidateIndex,
    lobeId: lobe.id,
    position,
    normal,
    exposure,
    score,
    scale:
      meanScale *
      random.range(settings.sizeRatio[0], settings.sizeRatio[1]),
    rotation: random.range(0, FOLIAGE_SHELL_CONSTANTS.tau),
    colorMix: random.next(),
    windPhase: random.range(0, FOLIAGE_SHELL_CONSTANTS.tau),
  };
}

function selectLobeShell(candidates, settings) {
  const exposed = candidates.filter(
    (candidate) => candidate.exposure >= settings.exposureThreshold,
  );
  const pool =
    exposed.length >= settings.instancesPerLobe ? exposed : candidates;

  pool.sort(
    (left, right) =>
      right.score - left.score ||
      left.candidateIndex - right.candidateIndex,
  );

  return selectDistributedCandidates(pool, settings.instancesPerLobe);
}

export class FoliageShellGenerator {
  generate(preset, lobes, random) {
    const settings = preset.foliage.shell;
    const crownCenter = calculateCrownCenter(lobes);
    const instances = [];
    const lobeExposure = [];

    for (const lobe of lobes) {
      const candidateCount =
        settings.instancesPerLobe * settings.candidateMultiplier;
      const phase = random.range(0, FOLIAGE_SHELL_CONSTANTS.tau);
      const candidates = [];

      for (let index = 0; index < candidateCount; index += 1) {
        candidates.push(
          createCandidate(
            lobe,
            createFibonacciDirection(index, candidateCount, phase),
            lobes,
            crownCenter,
            settings,
            random,
            index,
          ),
        );
      }

      const selected = selectLobeShell(candidates, settings);
      lobeExposure[lobe.id] =
        selected.reduce((total, candidate) => total + candidate.exposure, 0) /
        selected.length;

      for (const candidate of selected) {
        instances.push({
          id: instances.length,
          lobeId: candidate.lobeId,
          position: candidate.position,
          normal: candidate.normal,
          scale: candidate.scale,
          rotation: candidate.rotation,
          colorMix: candidate.colorMix,
          exposure: candidate.exposure,
          windPhase: candidate.windPhase,
        });
      }
    }

    return {
      instances,
      lobeExposure,
    };
  }
}
