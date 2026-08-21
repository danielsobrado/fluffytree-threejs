import { FoliageCoverageIndex } from './foliage-coverage-index.js?v=2.0.0-20260814.2';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js?v=2.0.0-20260814.2';

function maximumCoverageRadius(groups) {
  let maximum = 0;

  for (const group of groups) {
    for (const item of group) {
      maximum = Math.max(maximum, Number(item.coverageRadius));
    }
  }

  if (!(maximum > 0)) {
    throw new RangeError('Foliage coverage repair requires positive coverage radii.');
  }
  return maximum;
}

function compareIds(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function compareStableIds(left, right) {
  const leftId = left.candidateIndex ?? left.id;
  const rightId = right.candidateIndex ?? right.id;
  if (typeof leftId === 'number' && typeof rightId === 'number') {
    return leftId - rightId;
  }
  return String(leftId).localeCompare(String(rightId));
}

function compareCandidates(left, right) {
  return (
    Number(right.coverageRadius) - Number(left.coverageRadius) ||
    Number(right.score ?? right.exposure ?? 0) -
      Number(left.score ?? left.exposure ?? 0) ||
    compareIds(left.lobeId, right.lobeId) ||
    compareStableIds(left, right)
  );
}

function validateStopCoverageRatio(value) {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(
      'Foliage coverage repair stopCoverageRatio must be non-negative.',
    );
  }
}

export function repairFoliageCoverage(
  selected,
  repairCandidates,
  {
    stopCoverageRatio,
    verificationCandidates = repairCandidates,
  },
) {
  if (!Array.isArray(selected) || !Array.isArray(repairCandidates)) {
    throw new TypeError('Foliage coverage repair requires candidate arrays.');
  }
  if (!Array.isArray(verificationCandidates)) {
    throw new TypeError('Foliage coverage verification requires a candidate array.');
  }
  validateStopCoverageRatio(stopCoverageRatio);

  const allGroups = [selected, repairCandidates, verificationCandidates];
  if (allGroups.every((group) => group.length === 0)) {
    return Object.freeze({
      additions: Object.freeze([]),
      maximumCoverageRatio: 0,
      worst: null,
    });
  }

  const index = new FoliageCoverageIndex(maximumCoverageRadius(allGroups));
  for (const item of selected) index.add(item);

  const additions = [];
  const threshold =
    stopCoverageRatio + FOLIAGE_SHELL_CONSTANTS.coverageRatioEpsilon;
  for (const candidate of [...repairCandidates].sort(compareCandidates)) {
    if (index.nearestRatio(candidate) <= threshold) continue;
    additions.push(candidate);
    index.add(candidate);
  }

  let maximumCoverageRatio = 0;
  let worst = null;
  for (const candidate of verificationCandidates) {
    const ratio = index.nearestRatio(candidate);
    if (ratio <= maximumCoverageRatio) continue;
    maximumCoverageRatio = ratio;
    worst = candidate;
  }

  return Object.freeze({
    additions: Object.freeze(additions),
    maximumCoverageRatio,
    worst,
  });
}
