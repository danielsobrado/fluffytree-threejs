import { foliageCardCoverageRatio } from './foliage-card-coverage.js?v=2.0.0-20260814.2';
import { FoliageCoverageIndex } from './foliage-coverage-index.js?v=2.0.0-20260814.2';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js?v=2.0.0-20260814.2';
import { SpatialHashGrid } from './spatial-hash-grid.js?v=2.0.0-20260814.2';
import { StableMaxHeap } from './stable-max-heap.js?v=2.0.0-20260814.2';

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

function compareItemPriorityForSort(left, right) {
  const priorityDifference = itemPriority(right) - itemPriority(left);
  if (priorityDifference !== 0) return priorityDifference;

  const lobeDifference = compareIds(left.lobeId, right.lobeId);
  if (lobeDifference !== 0) return lobeDifference;
  return compareIds(itemStableId(left), itemStableId(right));
}

function compareItemPriorityForHeap(left, right) {
  const priorityDifference = itemPriority(left) - itemPriority(right);
  if (priorityDifference !== 0) return priorityDifference;

  const lobeDifference = compareIds(right.lobeId, left.lobeId);
  if (lobeDifference !== 0) return lobeDifference;
  return compareIds(itemStableId(right), itemStableId(left));
}

function compareRatios(left, right) {
  if (left === right) return 0;
  if (left === Number.POSITIVE_INFINITY) return 1;
  if (right === Number.POSITIVE_INFINITY) return -1;
  return left - right;
}

function compareCoverageRecords(left, right) {
  return (
    compareRatios(left.upperBound, right.upperBound) ||
    compareItemPriorityForHeap(left.item, right.item)
  );
}

function compareCoveragePriorityForSort(left, right) {
  return (
    Number(right.coverageRadius) - Number(left.coverageRadius) ||
    compareItemPriorityForSort(left, right)
  );
}

function coverageTargetPosition(item) {
  return item.surfacePoint ?? item.position;
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

function coverageRatio(candidate, selected) {
  return foliageCardCoverageRatio(candidate, selected);
}

function maximumCoverageRadius(items) {
  let maximum = 0;
  for (const item of items) maximum = Math.max(maximum, item.coverageRadius);
  return maximum;
}

function findNearbyCoverageRatio(grid, candidate) {
  let nearest = Number.POSITIVE_INFINITY;

  grid.findNear(coverageTargetPosition(candidate), (selected) => {
    nearest = Math.min(nearest, coverageRatio(candidate, selected));
    return false;
  });

  return nearest;
}

function selectCompleteCoverage(items, stopCoverageRatio) {
  const grid = new SpatialHashGrid(
    Math.max(
      maximumCoverageRadius(items) * Math.max(1, stopCoverageRatio),
      FOLIAGE_SHELL_CONSTANTS.minimumCellSize,
    ),
  );
  const selected = [];
  let maximumCoverageRatio = 0;
  let worst = null;

  for (const candidate of [...items].sort(compareCoveragePriorityForSort)) {
    const nearest = findNearbyCoverageRatio(grid, candidate);

    if (
      nearest <=
      stopCoverageRatio + FOLIAGE_SHELL_CONSTANTS.coverageRatioEpsilon
    ) {
      if (nearest > maximumCoverageRatio) {
        maximumCoverageRatio = nearest;
        worst = candidate;
      }
      continue;
    }

    selected.push(candidate);
    grid.insert(candidate.position, candidate);
    const selectedRatio = coverageRatio(candidate, candidate);
    if (selectedRatio > maximumCoverageRatio) {
      maximumCoverageRatio = selectedRatio;
      worst = candidate;
    }
  }

  return { selected, maximumCoverageRatio, worst };
}

function selectLobeAnchors(items) {
  const bestByLobe = new Map();

  for (const item of items) {
    const current = bestByLobe.get(item.lobeId);
    if (!current || compareItemPriorityForHeap(item, current) > 0) {
      bestByLobe.set(item.lobeId, item);
    }
  }

  return [...bestByLobe.entries()]
    .sort(([left], [right]) => compareIds(left, right))
    .map(([, item]) => item);
}

function bestItem(items) {
  let best = null;

  for (const item of items) {
    if (!best || compareItemPriorityForHeap(item, best) > 0) best = item;
  }

  return best;
}

function createCoverageIndex(items, selected) {
  const index = new FoliageCoverageIndex(maximumCoverageRadius(items));
  for (const item of selected) index.add(item);
  return index;
}

function isCurrentFarthest(record, heap) {
  const next = heap.peek();
  return !next || compareCoverageRecords(record, next) >= 0;
}

function selectFixedCountCoverage(items, targetCount, minimumPerLobe) {
  const anchors = minimumPerLobe ? selectLobeAnchors(items) : [bestItem(items)];
  if (anchors.length > targetCount) {
    throw new RangeError(
      'Foliage max-cover targetCount cannot be smaller than mandatory lobe anchors.',
    );
  }

  const selected = [];
  const selectedSet = new Set();

  for (const anchor of anchors) {
    if (!anchor || selectedSet.has(anchor)) continue;
    selected.push(anchor);
    selectedSet.add(anchor);
  }

  const index = createCoverageIndex(items, selected);
  const heap = new StableMaxHeap(compareCoverageRecords);

  for (const item of items) {
    if (selectedSet.has(item)) continue;
    heap.push({ item, upperBound: index.nearestRatio(item) });
  }

  while (selected.length < targetCount && heap.size > 0) {
    const record = heap.pop();
    if (!record || selectedSet.has(record.item)) continue;

    const refreshed = {
      item: record.item,
      upperBound: index.nearestRatio(record.item),
    };
    if (!isCurrentFarthest(refreshed, heap)) {
      heap.push(refreshed);
      continue;
    }

    selected.push(refreshed.item);
    selectedSet.add(refreshed.item);
    index.add(refreshed.item);
  }

  return { selected, index };
}

function calculateCoverage(items, index) {
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

  const result = selectFixedCountCoverage(
    items,
    boundedTarget,
    minimumPerLobe,
  );
  const coverage = calculateCoverage(items, result.index);

  return Object.freeze({
    selected: Object.freeze(result.selected),
    maximumCoverageRatio: coverage.maximumCoverageRatio,
    worst: coverage.worst,
  });
}
