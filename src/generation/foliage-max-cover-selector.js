import { createFoliageCoverageComponents } from './foliage-coverage-components.js';
import { FoliageCoverageIndex } from './foliage-coverage-index.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { StableMaxHeap } from './stable-max-heap.js';

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
  const priorityDifference = itemPriority(left) - itemPriority(right);
  if (priorityDifference !== 0) return priorityDifference;

  const lobeDifference = compareIds(left.lobeId, right.lobeId);
  if (lobeDifference !== 0) return -lobeDifference;

  return -compareIds(itemStableId(left), itemStableId(right));
}

function compareRatios(left, right) {
  if (left === right) return 0;
  if (left === Number.POSITIVE_INFINITY) return 1;
  if (right === Number.POSITIVE_INFINITY) return -1;
  return left - right;
}

function compareRecords(left, right) {
  return (
    compareRatios(left.upperBound, right.upperBound) ||
    compareItemPriority(left.item, right.item)
  );
}

function validateItem(item) {
  const coordinates = [
    item?.position?.x,
    item?.position?.y,
    item?.position?.z,
    item?.normal?.x,
    item?.normal?.y,
    item?.normal?.z,
  ];

  if (!coordinates.every(Number.isFinite)) {
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

function bestItem(items) {
  let best = null;
  for (const item of items) {
    if (!best || compareItemPriority(item, best) > 0) best = item;
  }
  return best;
}

function selectLobeAnchors(items) {
  const bestByLobe = new Map();

  for (const item of items) {
    const current = bestByLobe.get(item.lobeId);
    if (!current || compareItemPriority(item, current) > 0) {
      bestByLobe.set(item.lobeId, item);
    }
  }

  return [...bestByLobe.entries()]
    .sort(([left], [right]) => compareIds(left, right))
    .map(([, item]) => item);
}

function isCurrentFarthest(record, heap) {
  const next = heap.peek();
  return !next || compareRecords(record, next) >= 0;
}

function createCoverageIndex(items, selected) {
  const maximumCoverageRadius = Math.max(
    ...items.map((item) => item.coverageRadius),
  );
  const index = new FoliageCoverageIndex(maximumCoverageRadius);
  for (const item of selected) index.add(item);
  return index;
}

function calculateMaximumRatio(items, index) {
  let maximum = 0;
  let worst = null;

  for (const item of items) {
    const ratio = index.nearestRatio(item);
    if (ratio <= maximum) continue;
    maximum = ratio;
    worst = item;
  }

  return { maximum, worst };
}

function selectComponent(
  items,
  {
    targetCount,
    stopCoverageRatio,
    minimumPerLobe,
  },
) {
  const anchors = minimumPerLobe ? selectLobeAnchors(items) : [bestItem(items)];
  if (anchors.length > targetCount) {
    throw new RangeError(
      'Foliage max-cover targetCount cannot be smaller than mandatory lobe anchors.',
    );
  }

  const selected = [];
  const selectedSet = new Set();
  const index = createCoverageIndex(items, anchors);
  let maximumCoverageRatio = 0;
  let worst = null;

  for (const anchor of anchors) {
    if (selectedSet.has(anchor)) continue;
    selectedSet.add(anchor);
    selected.push(anchor);
  }

  const heap = new StableMaxHeap(compareRecords);
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

    if (
      stopCoverageRatio !== null &&
      refreshed.upperBound <=
        stopCoverageRatio + FOLIAGE_SHELL_CONSTANTS.coverageRatioEpsilon
    ) {
      maximumCoverageRatio = refreshed.upperBound;
      worst = refreshed.item;
      break;
    }

    selectedSet.add(refreshed.item);
    selected.push(refreshed.item);
    index.add(refreshed.item);
  }

  return {
    selected,
    index,
    maximumCoverageRatio,
    worst,
    stoppedByCoverage:
      stopCoverageRatio !== null && selected.length < targetCount,
  };
}

function selectIndependentCoverageComponents(items, stopCoverageRatio) {
  const components = createFoliageCoverageComponents(items).sort((left, right) =>
    -compareItemPriority(bestItem(left), bestItem(right)),
  );
  const selected = [];
  let maximumCoverageRatio = 0;
  let worst = null;

  for (const component of components) {
    const result = selectComponent(component, {
      targetCount: component.length,
      stopCoverageRatio,
      minimumPerLobe: false,
    });
    selected.push(...result.selected);

    if (result.maximumCoverageRatio > maximumCoverageRatio) {
      maximumCoverageRatio = result.maximumCoverageRatio;
      worst = result.worst;
    }
  }

  return { selected, maximumCoverageRatio, worst };
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
    const result = selectIndependentCoverageComponents(
      items,
      stopCoverageRatio,
    );
    return Object.freeze({
      selected: Object.freeze(result.selected),
      maximumCoverageRatio: result.maximumCoverageRatio,
      worst: result.worst,
    });
  }

  const result = selectComponent(items, {
    targetCount: boundedTarget,
    stopCoverageRatio,
    minimumPerLobe,
  });
  const coverage = calculateMaximumRatio(items, result.index);

  return Object.freeze({
    selected: Object.freeze(result.selected),
    maximumCoverageRatio: coverage.maximum,
    worst: coverage.worst,
  });
}
