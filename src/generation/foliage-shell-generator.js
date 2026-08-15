import { resolveFoliageContinuityProfile } from '../domain/foliage-continuity-config.js';
import { createFoliageAlphaProfile } from '../rendering/foliage-alpha-profile.js';
import { createFoliageCardSizing } from './foliage-card-sizing.js';
import {
  calculateFoliageRepairProbeCount,
  resolveFoliageCoveragePolicy,
} from './foliage-coverage-policy.js';
import { repairFoliageCoverage } from './foliage-coverage-repair.js';
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

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function averageScale(lobe) {
  return (lobe.scale.x + lobe.scale.y + lobe.scale.z) / 3;
}

function calculateCrownCenter(lobes) {
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

function createFibonacciDirection(index, count, phase, verticalOffset = 0) {
  const sampleIndex = index + 0.5 + verticalOffset;
  const y = 1 - 2 * (sampleIndex / count);
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

function createCoverageRepairCandidates(
  lobes,
  primaryPhases,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  random,
  probeCount,
  passIndex,
) {
  if (probeCount <= 0) return [];

  const candidates = [];
  const candidateOffset = settings.candidatesPerLobe + passIndex * probeCount;

  for (const lobe of lobes) {
    const phase =
      primaryPhases.get(lobe.id) +
      FOLIAGE_SHELL_CONSTANTS.coverageRepairPhaseOffset +
      passIndex * FOLIAGE_SHELL_CONSTANTS.coverageRepairPhaseStep;
    const verticalOffset =
      Math.sin(phase) *
      FOLIAGE_SHELL_CONSTANTS.coverageRepairMaximumVerticalOffset;

    for (let index = 0; index < probeCount; index += 1) {
      const candidate = createCandidate(
        lobe,
        createFibonacciDirection(index, probeCount, phase, verticalOffset),
        lobes,
        crownCenter,
        settings,
        maximumCardWidthSpread,
        alphaProfile,
        random,
        candidateOffset + index,
      );
      if (candidate.exposure >= settings.exposureThreshold) {
        candidates.push(candidate);
      }
    }
  }

  return candidates;
}

function repairCoverage(
  selected,
  lobes,
  primaryPhases,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  coveragePolicy,
  random,
  initialCoverageRatio,
) {
  const probeCount = calculateFoliageRepairProbeCount(
    settings.candidatesPerLobe,
    coveragePolicy.probeRatio,
  );
  let maximumCoverageRatio = initialCoverageRatio;

  for (let passIndex = 0; passIndex < coveragePolicy.passCount; passIndex += 1) {
    const repairCandidates = createCoverageRepairCandidates(
      lobes,
      primaryPhases,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      random,
      probeCount,
      passIndex,
    );
    if (repairCandidates.length === 0) break;

    const repair = repairFoliageCoverage(selected, repairCandidates, {
      stopCoverageRatio: coveragePolicy.stopCoverageRatio,
    });
    selected.push(...repair.additions);
    maximumCoverageRatio = repair.maximumCoverageRatio;

    // A staggered pass that adds nothing independently confirms its probe grid.
    if (repair.additions.length === 0) break;
  }

  return maximumCoverageRatio;
}

export class FoliageShellGenerator {
  generate(preset, sourceLobes, random) {
    const settings = preset.foliage.shell;
    const continuity = resolveFoliageContinuityProfile(
      preset.continuity,
      preset.crown.profile,
    );
    const maximumCardWidthSpread = continuity.maximumShellCardWidthSpread;
    const alphaProfile = createFoliageAlphaProfile({
      shapeId: preset.foliage.leafShape,
      alphaTest: settings.alphaTest,
      planesPerCluster: settings.planesPerCluster,
    });
    const coveragePolicy = resolveFoliageCoveragePolicy(alphaProfile, continuity);
    const lobes = prepareExposureLobes(sourceLobes);
    const crownCenter = calculateCrownCenter(lobes);
    const bestByLobe = new Map();
    const primaryPhases = new Map();
    const exposed = [];

    for (const lobe of lobes) {
      const phase = random.range(0, FOLIAGE_SHELL_CONSTANTS.tau);
      primaryPhases.set(lobe.id, phase);
      let best = null;

      for (let index = 0; index < settings.candidatesPerLobe; index += 1) {
        const candidate = createCandidate(
          lobe,
          createFibonacciDirection(index, settings.candidatesPerLobe, phase),
          lobes,
          crownCenter,
          settings,
          maximumCardWidthSpread,
          alphaProfile,
          random,
          index,
        );

        if (!best || compareCandidates(candidate, best) < 0) best = candidate;
        if (candidate.exposure >= settings.exposureThreshold) exposed.push(candidate);
      }

      bestByLobe.set(lobe.id, best);
    }

    const maxCover = selectDeterministicFoliageMaxCover(exposed, {
      targetCount: exposed.length,
      stopCoverageRatio: Math.min(
        FOLIAGE_SHELL_CONSTANTS.primaryCoverageStopRatio,
        coveragePolicy.stopCoverageRatio,
      ),
      minimumPerLobe: false,
    });
    const selected = [...maxCover.selected];
    selected.push(...coverEveryLobe(selected, bestByLobe));

    const maximumCandidateCoverageRatio = repairCoverage(
      selected,
      lobes,
      primaryPhases,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      coveragePolicy,
      random,
      maxCover.maximumCoverageRatio,
    );
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
        shellScale: candidate.shellScale,
        widthRatio: candidate.widthRatio,
        outwardRatio: candidate.outwardRatio,
        cardWidth: candidate.cardWidth,
        rotation: candidate.rotation,
        colorMix: candidate.colorMix,
        exposure: candidate.exposure,
        clearance: candidate.clearance,
        coverageRadius: candidate.coverageRadius,
        alphaCoverageRadius: candidate.alphaCoverageRadius,
        leafShape: candidate.leafShape,
        alphaTest: candidate.alphaTest,
        planesPerCluster: candidate.planesPerCluster,
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
      maximumCandidateCoverageRatio,
    };
  }
}
