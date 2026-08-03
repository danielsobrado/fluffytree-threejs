import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { selectDeterministicFoliageMaxCover } from './foliage-max-cover-selector.js';
import {
  calculateLobeClearance,
  clearanceToExposure,
  prepareExposureLobes,
} from './lobe-exposure.js';
import {
  lobeSurfaceNormal,
  normalizeVector,
  pointOnLobeSurface,
} from './lobe-geometry.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js';

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

function normalDot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
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
  const scale = meanScale * random.range(settings.sizeRatio[0], settings.sizeRatio[1]);
  const widthRatio = random.range(settings.widthRatio[0], settings.widthRatio[1]);
  const outwardRatio = random.range(
    settings.outwardRatio[0],
    settings.outwardRatio[1],
  );
  const cardWidth =
    scale *
    widthRatio *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;

  return {
    candidateIndex,
    lobeId: lobe.id,
    surfacePoint,
    position,
    normal,
    exposure,
    clearance,
    score,
    cardWidth,
    coverageRadius: cardWidth * settings.coverageCardRatio,
    scale,
    widthRatio,
    outwardRatio,
    rotation: random.range(0, FOLIAGE_SHELL_CONSTANTS.tau),
    colorMix: clamp01(lobe.colorMix + random.signed() * settings.colorJitter),
    windPhase: random.range(0, FOLIAGE_SHELL_CONSTANTS.tau),
  };
}

function compareCandidates(left, right) {
  return (
    right.score - left.score ||
    left.lobeId - right.lobeId ||
    left.candidateIndex - right.candidateIndex
  );
}

function coverEveryLobe(selected, bestByLobe) {
  const covered = new Set(selected.map((candidate) => candidate.lobeId));
  const additions = [];

  for (const [lobeId, candidate] of bestByLobe) {
    if (covered.has(lobeId) || !candidate) continue;
    additions.push(candidate);
  }

  return additions;
}

export class FoliageShellGenerator {
  generate(preset, sourceLobes, random) {
    const settings = preset.foliage.shell;
    const lobes = prepareExposureLobes(sourceLobes);
    const crownCenter = calculateCrownCenter(lobes);
    const bestByLobe = new Map();
    const exposed = [];

    for (const lobe of lobes) {
      const phase = random.range(0, FOLIAGE_SHELL_CONSTANTS.tau);
      let best = null;

      for (let index = 0; index < settings.candidatesPerLobe; index += 1) {
        const candidate = createCandidate(
          lobe,
          createFibonacciDirection(index, settings.candidatesPerLobe, phase),
          lobes,
          crownCenter,
          settings,
          random,
          index,
        );

        if (!best || compareCandidates(candidate, best) < 0) best = candidate;
        if (candidate.exposure >= settings.exposureThreshold) exposed.push(candidate);
      }

      bestByLobe.set(lobe.id, best);
    }

    exposed.sort(compareCandidates);
    const maxCover = selectDeterministicFoliageMaxCover(exposed, {
      targetCount: exposed.length,
      stopCoverageRatio: 0.5,
      minimumPerLobe: false,
    });
    const selected = [...maxCover.selected];
    selected.push(...coverEveryLobe(selected, bestByLobe));
    selected.sort(compareCandidates);

    const lobeExposureTotals = new Map();
    const instances = selected.map((candidate, index) => {
      const totals = lobeExposureTotals.get(candidate.lobeId) ?? {
        total: 0,
        count: 0,
      };
      totals.total += candidate.exposure;
      totals.count += 1;
      lobeExposureTotals.set(candidate.lobeId, totals);

      return {
        id: index,
        lobeId: candidate.lobeId,
        surfacePoint: candidate.surfacePoint,
        position: candidate.position,
        normal: candidate.normal,
        scale: candidate.scale,
        widthRatio: candidate.widthRatio,
        outwardRatio: candidate.outwardRatio,
        cardWidth: candidate.cardWidth,
        rotation: candidate.rotation,
        colorMix: candidate.colorMix,
        exposure: candidate.exposure,
        clearance: candidate.clearance,
        coverageRadius: candidate.coverageRadius,
        windPhase: candidate.windPhase,
      };
    });

    const lobeExposure = [];
    for (const lobe of lobes) {
      const totals = lobeExposureTotals.get(lobe.id);
      lobeExposure[lobe.id] = totals ? totals.total / totals.count : 0;
    }

    return {
      instances,
      lobeExposure,
      maximumCandidateCoverageRatio: maxCover.maximumCoverageRatio,
    };
  }
}
