import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import {
  lobeSurfaceNormal,
  normalizeVector,
  normalizedRotatedPointDistance,
  pointOnLobeSurface,
} from './lobe-geometry.js';
import { SpatialHashGrid } from './spatial-hash-grid.js';

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

function distanceSquared(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
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
    (normalDot(normal, outward) + FOLIAGE_SHELL_CONSTANTS.outwardBias) /
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
    surfacePoint,
    position,
    normal,
    exposure,
    clearance,
    score,
    coverageRadius: meanScale * settings.coverageRadiusRatio,
    scale: meanScale * random.range(settings.sizeRatio[0], settings.sizeRatio[1]),
    widthRatio: random.range(settings.widthRatio[0], settings.widthRatio[1]),
    outwardRatio: random.range(
      settings.outwardRatio[0],
      settings.outwardRatio[1],
    ),
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

/**
 * Deterministic maximal Poisson-disk selection over the whole crown.
 *
 * Candidates are visited in score order and accepted unless an already accepted
 * cluster covers them: near enough in space and facing a similar way, so a card
 * on the far side of a thin crown cannot claim to cover this one. Because the
 * pass only stops when no candidate can still be added, every rejected candidate
 * has a compatible cluster within that cluster's covering radius. That is the
 * property the previous per-lobe score-and-normal-separation selection lacked:
 * it balanced exposure against normal difference and left whole lobes bare.
 */
function selectCoveringCandidates(candidates, cellSize) {
  const grid = new SpatialHashGrid(cellSize);
  const selected = [];

  for (const candidate of candidates) {
    const covering = grid.findNear(candidate.position, (accepted) => {
      const radius = accepted.coverageRadius;
      return (
        distanceSquared(candidate.position, accepted.position) < radius * radius &&
        normalDot(candidate.normal, accepted.normal) >=
          FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot
      );
    });

    if (covering) continue;

    grid.insert(candidate.position, candidate);
    selected.push(candidate);
  }

  return selected;
}

/**
 * A lobe with no accepted cluster renders as bare core wherever it reaches the
 * crown surface. Its best candidate is added unconditionally, even when the lobe
 * looked fully buried at candidate density, because a denser look at the same
 * surface can still find exposed ground there. One extra card per lobe is
 * negligible, and it makes "every lobe carries a leaf card" true without
 * qualification.
 */
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
  generate(preset, lobes, random) {
    const settings = preset.foliage.shell;
    const crownCenter = calculateCrownCenter(lobes);
    const bestByLobe = new Map();
    const exposed = [];
    let maximumCoverageRadius = 0;

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
        if (candidate.exposure < settings.exposureThreshold) continue;

        exposed.push(candidate);
        maximumCoverageRadius = Math.max(
          maximumCoverageRadius,
          candidate.coverageRadius,
        );
      }

      bestByLobe.set(lobe.id, best);
    }

    exposed.sort(compareCandidates);
    const selected = selectCoveringCandidates(
      exposed,
      Math.max(maximumCoverageRadius, FOLIAGE_SHELL_CONSTANTS.minimumCellSize),
    );
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
        position: candidate.position,
        normal: candidate.normal,
        scale: candidate.scale,
        widthRatio: candidate.widthRatio,
        outwardRatio: candidate.outwardRatio,
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
    };
  }
}
