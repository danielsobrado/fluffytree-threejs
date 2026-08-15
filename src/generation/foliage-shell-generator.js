import { resolveFoliageContinuityProfile } from '../domain/foliage-continuity-config.js';
import { createFoliageAlphaProfile } from '../rendering/foliage-alpha-profile.js';
import { repairAdaptiveFoliageCoverage } from './foliage-adaptive-repair-runner.js';
import { resolveFoliageCoveragePolicy } from './foliage-coverage-policy.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import {
  calculateFoliageCrownCenter,
  createFibonacciDirection,
  createFoliageShellCandidate,
} from './foliage-shell-candidate-factory.js';
import { selectDeterministicFoliageMaxCover } from './foliage-max-cover-selector.js';
import { prepareExposureLobes } from './lobe-exposure.js';

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

function createInstances(selected, lobes) {
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

  return { instances, lobeExposure };
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
    const crownCenter = calculateFoliageCrownCenter(lobes);
    const bestByLobe = new Map();
    const exposed = [];

    for (const lobe of lobes) {
      const phase = random.range(0, FOLIAGE_SHELL_CONSTANTS.tau);
      let best = null;

      for (let index = 0; index < settings.candidatesPerLobe; index += 1) {
        const candidate = createFoliageShellCandidate(
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

    const maximumCandidateCoverageRatio = repairAdaptiveFoliageCoverage(
      selected,
      lobes,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      coveragePolicy,
      random,
      maxCover.maximumCoverageRatio,
    );
    selected.sort(compareCandidates);

    const result = createInstances(selected, lobes);
    return {
      instances: result.instances,
      lobeExposure: result.lobeExposure,
      maximumCandidateCoverageRatio,
    };
  }
}
