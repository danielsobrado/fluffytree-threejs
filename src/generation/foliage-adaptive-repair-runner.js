import { inspectAdaptiveFoliageCoverage } from './adaptive-foliage-coverage-repair.js';
import { calculateFoliageRepairBudget } from './foliage-coverage-policy.js';
import { repairFoliageCoverage } from './foliage-coverage-repair.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
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
      settings.candidatesPerLobe * (passIndex + 1) + localIndex,
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

function inspectCoverage(
  selected,
  lobes,
  settings,
  coveragePolicy,
  repairBudget,
  certification,
) {
  return inspectAdaptiveFoliageCoverage(selected, lobes, {
    stopCoverageRatio: coveragePolicy.stopCoverageRatio,
    exposureThreshold: settings.exposureThreshold,
    maximumSubdivisionDepth: certification
      ? coveragePolicy.certificationMaximumSubdivisionDepth
      : coveragePolicy.maximumSubdivisionDepth,
    minimumDirectionDiameter: certification
      ? coveragePolicy.certificationMinimumDirectionDiameter
      : coveragePolicy.minimumDirectionDiameter,
    normalUncertaintyScale: coveragePolicy.normalUncertaintyScale,
    maximumHolesPerLobe: Math.max(1, repairBudget),
  });
}

export function isFoliageCoverageCertified(
  inspection,
  stopCoverageRatio,
) {
  return (
    inspection.holes.length === 0 &&
    inspection.unresolvedTriangleCount === 0 &&
    inspection.maximumCoverageRatio <=
      stopCoverageRatio + FOLIAGE_SHELL_CONSTANTS.coverageRatioEpsilon
  );
}

function applyRepairPass(
  selected,
  inspection,
  lobesById,
  lobes,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  coveragePolicy,
  random,
  passIndex,
) {
  const repairCandidates = createRepairCandidates(
    inspection.holes,
    lobesById,
    lobes,
    crownCenter,
    settings,
    maximumCardWidthSpread,
    alphaProfile,
    random,
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
  selected.push(...repair.additions);

  return forced.length + repair.additions.length;
}

function runRepairPhase(
  selected,
  lobes,
  crownCenter,
  settings,
  maximumCardWidthSpread,
  alphaProfile,
  coveragePolicy,
  random,
  lobesById,
  {
    repairBudget,
    certification,
    passOffset,
  },
) {
  let inspection = inspectCoverage(
    selected,
    lobes,
    settings,
    coveragePolicy,
    repairBudget,
    certification,
  );
  let additions = 0;

  for (let pass = 0; pass < coveragePolicy.maximumPasses; pass += 1) {
    if (isFoliageCoverageCertified(inspection, coveragePolicy.stopCoverageRatio)) {
      break;
    }
    if (inspection.holes.length === 0 || repairBudget === 0) break;

    const added = applyRepairPass(
      selected,
      inspection,
      lobesById,
      lobes,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      coveragePolicy,
      random,
      passOffset + pass,
    );
    additions += added;
    if (added === 0) break;

    inspection = inspectCoverage(
      selected,
      lobes,
      settings,
      coveragePolicy,
      repairBudget,
      certification,
    );
  }

  return { inspection, additions };
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
  const emergencyBudget = calculateFoliageRepairBudget(
    settings.candidatesPerLobe,
    coveragePolicy.emergencyRepairBudgetRatio,
  );
  const lobesById = new Map(lobes.map((lobe) => [lobe.id, lobe]));

  const normal = runRepairPhase(
    selected,
    lobes,
    crownCenter,
    settings,
    maximumCardWidthSpread,
    alphaProfile,
    coveragePolicy,
    random,
    lobesById,
    {
      repairBudget,
      certification: false,
      passOffset: 0,
    },
  );

  let finalInspection = normal.inspection;
  let emergencyAdditions = 0;
  let emergencyUsed = false;

  if (!isFoliageCoverageCertified(finalInspection, coveragePolicy.stopCoverageRatio)) {
    emergencyUsed = true;
    const emergency = runRepairPhase(
      selected,
      lobes,
      crownCenter,
      settings,
      maximumCardWidthSpread,
      alphaProfile,
      coveragePolicy,
      random,
      lobesById,
      {
        repairBudget: emergencyBudget,
        certification: true,
        passOffset: coveragePolicy.maximumPasses,
      },
    );
    finalInspection = emergency.inspection;
    emergencyAdditions = emergency.additions;
  }

  const certified = isFoliageCoverageCertified(
    finalInspection,
    coveragePolicy.stopCoverageRatio,
  );

  return Object.freeze({
    maximumCoverageRatio: Math.max(
      initialCoverageRatio,
      finalInspection.maximumCoverageRatio,
    ),
    certified,
    emergencyUsed,
    normalRepairCount: normal.additions,
    emergencyRepairCount: emergencyAdditions,
    remainingHoleCount: finalInspection.holes.length,
    unresolvedTriangleCount: finalInspection.unresolvedTriangleCount,
    maximumSubdivisionDepthReached: finalInspection.maximumDepthReached,
  });
}
