import { inspectAdaptiveFoliageCoverage } from './adaptive-foliage-coverage-repair.js';
import { calculateFoliageRepairBudget } from './foliage-coverage-policy.js';
import { repairFoliageCoverage } from './foliage-coverage-repair.js';
import { createFoliageShellCandidate } from './foliage-shell-candidate-factory.js';

function createRepairCandidates(
  holes,
  lobesById,
  lobes,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  random,
  repairBudget,
  passIndex,
) {
  const localIndexes = new Map();
  const candidates = [];

  for (const hole of holes) {
    const lobe = lobesById.get(hole.lobeId);
    if (!lobe) continue;

    const localIndex = localIndexes.get(hole.lobeId) ?? 0;
    localIndexes.set(hole.lobeId, localIndex + 1);
    const candidate = createFoliageShellCandidate(
      lobe,
      hole.direction,
      lobes,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      random,
      settings.candidatesPerLobe + passIndex * repairBudget + localIndex,
      {
        preferMaximumCardWidth: true,
        coverageRepairKind: hole.kind,
        coverageRepairRatio: hole.coverageRatio,
      },
    );
    candidates.push({
      candidate,
      force: hole.kind === 'uncertified',
    });
  }

  return candidates;
}

export function repairAdaptiveFoliageCoverage(
  selected,
  lobes,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  coveragePolicy,
  random,
  initialCoverageRatio,
) {
  const repairBudget = calculateFoliageRepairBudget(
    settings.candidatesPerLobe,
    coveragePolicy.repairBudgetRatio,
  );
  if (repairBudget === 0) return initialCoverageRatio;

  const lobesById = new Map(lobes.map((lobe) => [lobe.id, lobe]));
  let maximumCoverageRatio = initialCoverageRatio;

  for (
    let passIndex = 0;
    passIndex <= coveragePolicy.maximumPasses;
    passIndex += 1
  ) {
    const inspection = inspectAdaptiveFoliageCoverage(selected, lobes, {
      stopCoverageRatio: coveragePolicy.stopCoverageRatio,
      exposureThreshold: settings.exposureThreshold,
      maximumSubdivisionDepth: coveragePolicy.maximumSubdivisionDepth,
      minimumDirectionDiameter: coveragePolicy.minimumDirectionDiameter,
      normalUncertaintyScale: coveragePolicy.normalUncertaintyScale,
      maximumHolesPerLobe: repairBudget,
    });
    maximumCoverageRatio = inspection.maximumCoverageRatio;

    if (inspection.holes.length === 0) break;
    if (passIndex === coveragePolicy.maximumPasses) break;

    const repairCandidates = createRepairCandidates(
      inspection.holes,
      lobesById,
      lobes,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      random,
      repairBudget,
      passIndex,
    );
    const forced = repairCandidates
      .filter((record) => record.force)
      .map((record) => record.candidate);
    selected.push(...forced);

    const repair = repairFoliageCoverage(
      selected,
      repairCandidates
        .filter((record) => !record.force)
        .map((record) => record.candidate),
      { stopCoverageRatio: coveragePolicy.stopCoverageRatio },
    );
    if (forced.length === 0 && repair.additions.length === 0) break;
    selected.push(...repair.additions);
  }

  return maximumCoverageRatio;
}
