import { FoliageCoverageIndex } from './foliage-coverage-index.js';
import { selectHierarchicalFoliageMaxCover } from './foliage-max-cover-partitioner.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { SpatialHashGrid } from './spatial-hash-grid.js';

function compareIds(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function itemStableId(item) {
  return item.candidateIndex ?? item.id;
}

function itemPriority(item) {
  const score = Number(item.score);
  if (Number.isFinite(score)) return score;
  return Number(item.exposure ?? 0);
}

function compareItemPriority(left, right) {
  const priorityDifference = itemPriority(right) - itemPriority(left);
  if (priorityDifference !== 0) return priorityDifference;

  const lobeDifference = compareIds(left.lobeId, right.lobeId);
  if (lobeDifference !== 0) return lobeDifference;
  return compareIds(itemStableId(left), itemStableId(right));
}

function normalDot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function distanceSquared(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

function validateItem(item) {
  const values = [
    item?.position?.x,
    item?.position?.y,
    item?.position?.z,
    item?.normal?.x,
    item?.normal?.y,
    item?.normal?.z,
  ];

  if (!values.every(Number.isFinite)) {
    throw new TypeError(
      'Foliage max-cover items require finite position and normal values.',
    );
  }
  if (!(item.coverageRadius > 0)) {
    throw new RangeError(
      'Foliage max-cover items require a positive coverage radius.',
    );
  }
}

function isCovered(candidate, selected, coverageRatio) {
  if (
    normalDot(candidate.normal, selected.normal) <
    FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot
  ) {
    return false;
  }

  const radius = selected.coverageRadius * coverageRatio;
  return distanceSquared(candidate.position, selected.position) <= radius * radius;
}

function selectCompleteCoverage(items, stopCoverageRatio) {
  const maximumCoverageRadius = Math.max(
    ...items.map((item) => item.coverageRadius),
  );
  const grid = new SpatialHashGrid(
    Math.max(
      maximumCoverageRadius * Math.max(1, stopCoverageRatio),
      FOLIAGE_SHELL_CONSTANTS.minimumCellSize,
    ),
  );
  const selected = [];
  let worst = null;

  for (const candidate of [...items].sort(compareItemPriority)) {
    const covering = grid.findNear(candidate.position, (accepted) =>
      isCovered(candidate, accepted, stopCoverageRatio),
    );

    if (covering) {
      worst ??= candidate;
      continue;
    }

    selected.push(candidate);
    grid.insert(candidate.position, candidate);
  }

  return {
    selected,
    maximumCoverageRatio: worst ? stopCoverageRatio : 0,
    worst,
  };
}

function calculateCoverage(items, selected) {
  const maximumCoverageRadius = Math.max(
    ...items.map((item) => item.coverageRadius),
  );
  const index = new FoliageCoverageIndex(maximumCoverageRadius);
  for (const item of selected) index.add(item);

  let maximumCoverageRatio = 0;
  let worst = null;

  for (const item of items) {
    const ratio = index.nearestRatio(item);
    if (ratio <= maximumCoverageRatio) continue;
    maximumCoverageRatio = ratio;
    worst = item;
  }

  return { maximumCoverageRatio, worst };
}

export function selectDeterministicFoliageMaxCover(
  items,
  {
    targetCount = items.length,
    stopCoverageRatio = 1,
    minimumPerLobe = false,
  } = {},
) {
  if (!Array.isArray(items)) {
    throw new TypeError('Foliage max-cover selection requires an array.');
  }
  if (!Number.isSafeInteger(targetCount) || targetCount < 0) {
    throw new RangeError(
      'Foliage max-cover targetCount must be a non-negative integer.',
    );
  }
  if (
    stopCoverageRatio !== null &&
    (!Number.isFinite(stopCoverageRatio) || stopCoverageRatio < 0)
  ) {
    throw new RangeError(
      'Foliage max-cover stopCoverageRatio must be null or non-negative.',
    );
  }
  if (items.length === 0 || targetCount === 0) {
    return Object.freeze({
      selected: Object.freeze([]),
      maximumCoverageRatio: 0,
      worst: null,
    });
  }

  for (const item of items) validateItem(item);

  const boundedTarget = Math.min(targetCount, items.length);
  const completeCoverageMode =
    stopCoverageRatio !== null &&
    boundedTarget === items.length &&
    !minimumPerLobe;

  if (completeCoverageMode) {
    const result = selectCompleteCoverage(items, stopCoverageRatio);
    return Object.freeze({
      selected: Object.freeze(result.selected),
      maximumCoverageRatio: result.maximumCoverageRatio,
      worst: result.worst,
    });
  }

  const selected = selectHierarchicalFoliageMaxCover(items, boundedTarget, {
    minimumPerLobe,
  });
  const coverage = calculateCoverage(items, selected);

  return Object.freeze({
    selected: Object.freeze(selected),
    maximumCoverageRatio: coverage.maximumCoverageRatio,
    worst: coverage.worst,
  });
}
