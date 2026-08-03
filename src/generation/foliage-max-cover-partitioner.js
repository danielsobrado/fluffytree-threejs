import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { StableMaxHeap } from './stable-max-heap.js';

const FEATURE_COUNT = 6;
const POSITION_FEATURE_COUNT = 3;

function compareIds(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function stableId(item) {
  return item.candidateIndex ?? item.id;
}

function priority(item) {
  const score = Number(item.score);
  if (Number.isFinite(score)) return score;
  return Number(item.exposure ?? 0);
}

function compareItemPriority(left, right) {
  const priorityDifference = priority(left) - priority(right);
  if (priorityDifference !== 0) return priorityDifference;

  const lobeDifference = compareIds(left.lobeId, right.lobeId);
  if (lobeDifference !== 0) return -lobeDifference;
  return -compareIds(stableId(left), stableId(right));
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

function calculatePositionBounds(items) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];

  for (const item of items) {
    const values = [item.position.x, item.position.y, item.position.z];
    for (let axis = 0; axis < POSITION_FEATURE_COUNT; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], values[axis]);
      maximum[axis] = Math.max(maximum[axis], values[axis]);
    }
  }

  return { minimum, maximum };
}

function createFeatureEntries(items) {
  const bounds = calculatePositionBounds(items);

  return items.map((item) => {
    const positions = [item.position.x, item.position.y, item.position.z];
    const normalizedPosition = positions.map((value, axis) => {
      const extent = bounds.maximum[axis] - bounds.minimum[axis];
      return extent <= Number.EPSILON
        ? 0.5
        : (value - bounds.minimum[axis]) / extent;
    });
    const normalWeight = FOLIAGE_SHELL_CONSTANTS.maxCoverNormalWeight;

    return {
      item,
      features: [
        ...normalizedPosition,
        item.normal.x * normalWeight,
        item.normal.y * normalWeight,
        item.normal.z * normalWeight,
      ],
    };
  });
}

function calculateNodeBounds(entries) {
  const minimum = Array(FEATURE_COUNT).fill(Infinity);
  const maximum = Array(FEATURE_COUNT).fill(-Infinity);

  for (const entry of entries) {
    for (let axis = 0; axis < FEATURE_COUNT; axis += 1) {
      minimum[axis] = Math.min(minimum[axis], entry.features[axis]);
      maximum[axis] = Math.max(maximum[axis], entry.features[axis]);
    }
  }

  let splitAxis = 0;
  let maximumSpread = -1;
  for (let axis = 0; axis < FEATURE_COUNT; axis += 1) {
    const spread = maximum[axis] - minimum[axis];
    if (spread > maximumSpread) {
      maximumSpread = spread;
      splitAxis = axis;
    }
  }

  return { minimum, maximum, splitAxis, maximumSpread };
}

function createNode(entries, serial) {
  return {
    entries,
    serial,
    ...calculateNodeBounds(entries),
  };
}

function compareNodes(left, right) {
  return (
    left.maximumSpread - right.maximumSpread ||
    left.entries.length - right.entries.length ||
    right.serial - left.serial
  );
}

function compareEntriesByAxis(left, right, axis) {
  return (
    left.features[axis] - right.features[axis] ||
    compareIds(stableId(left.item), stableId(right.item))
  );
}

function splitNode(node, nextSerial) {
  const entries = [...node.entries].sort((left, right) =>
    compareEntriesByAxis(left, right, node.splitAxis),
  );
  const middle = Math.floor(entries.length / 2);

  return [
    createNode(entries.slice(0, middle), nextSerial),
    createNode(entries.slice(middle), nextSerial + 1),
  ];
}

function selectNodeRepresentative(node) {
  const centroid = Array(FEATURE_COUNT).fill(0);
  for (const entry of node.entries) {
    for (let axis = 0; axis < FEATURE_COUNT; axis += 1) {
      centroid[axis] += entry.features[axis];
    }
  }
  for (let axis = 0; axis < FEATURE_COUNT; axis += 1) {
    centroid[axis] /= node.entries.length;
  }

  let representative = null;
  let minimumDistance = Number.POSITIVE_INFINITY;

  for (const entry of node.entries) {
    let distanceSquared = 0;
    for (let axis = 0; axis < FEATURE_COUNT; axis += 1) {
      const difference = entry.features[axis] - centroid[axis];
      distanceSquared += difference * difference;
    }

    if (
      distanceSquared < minimumDistance ||
      (distanceSquared === minimumDistance &&
        (!representative ||
          compareItemPriority(entry.item, representative) > 0))
    ) {
      representative = entry.item;
      minimumDistance = distanceSquared;
    }
  }

  return representative;
}

export function selectHierarchicalFoliageMaxCover(
  items,
  targetCount,
  { minimumPerLobe = true } = {},
) {
  if (!Number.isSafeInteger(targetCount) || targetCount < 0) {
    throw new RangeError('Hierarchical max-cover targetCount must be non-negative.');
  }
  if (items.length === 0 || targetCount === 0) return [];

  const boundedTarget = Math.min(targetCount, items.length);
  const anchors = minimumPerLobe ? selectLobeAnchors(items) : [];
  if (anchors.length > boundedTarget) {
    throw new RangeError(
      'Hierarchical max-cover targetCount cannot be smaller than lobe anchors.',
    );
  }

  const anchorSet = new Set(anchors);
  const remaining = items.filter((item) => !anchorSet.has(item));
  const remainingTarget = boundedTarget - anchors.length;
  if (remainingTarget === 0) return anchors;
  if (remainingTarget >= remaining.length) return [...anchors, ...remaining];

  const heap = new StableMaxHeap(compareNodes);
  const leaves = [];
  let serial = 0;
  heap.push(createNode(createFeatureEntries(remaining), serial));
  serial += 1;

  while (heap.size + leaves.length < remainingTarget) {
    const node = heap.pop();
    if (!node) break;

    if (node.entries.length <= 1) {
      leaves.push(node);
      continue;
    }

    const children = splitNode(node, serial);
    serial += children.length;
    for (const child of children) heap.push(child);
  }

  while (heap.size > 0) leaves.push(heap.pop());
  const representatives = leaves
    .slice(0, remainingTarget)
    .map(selectNodeRepresentative);
  return [...anchors, ...representatives];
}
