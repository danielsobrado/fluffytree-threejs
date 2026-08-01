import {
  lobeOverlapRatio,
  normalizedPointDistance,
} from '../generation/lobe-geometry.js';

function createAdjacency(lobes) {
  const adjacency = Array.from({ length: lobes.length }, () => []);

  for (let left = 0; left < lobes.length; left += 1) {
    for (let right = left + 1; right < lobes.length; right += 1) {
      if (lobeOverlapRatio(lobes[left], lobes[right]) <= 1) {
        adjacency[left].push(right);
        adjacency[right].push(left);
      }
    }
  }

  return adjacency;
}

function countComponents(adjacency) {
  const visited = new Set();
  let count = 0;

  for (let index = 0; index < adjacency.length; index += 1) {
    if (visited.has(index)) continue;
    count += 1;
    const pending = [index];
    visited.add(index);

    while (pending.length > 0) {
      const current = pending.pop();
      for (const neighbor of adjacency[current]) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          pending.push(neighbor);
        }
      }
    }
  }

  return count;
}

function analyzeBranches(tree) {
  const distances = [];
  const targets = new Set();
  let missingTargets = 0;

  for (const branch of tree.branches) {
    const target = tree.lobes.find(
      (lobe) => lobe.id === branch.targetLobeId,
    );
    const endpoint = branch.points.at(-1);

    if (!target || !endpoint) {
      missingTargets += 1;
      continue;
    }

    targets.add(target.id);
    distances.push(normalizedPointDistance(endpoint, target));
  }

  return {
    branchTargetCount: targets.size,
    missingBranchTargetCount: missingTargets,
    minimumBranchInsertion:
      distances.length === 0 ? 0 : Math.min(...distances),
    maximumBranchInsertion:
      distances.length === 0 ? 0 : Math.max(...distances),
  };
}

function analyzeTrunk(tree) {
  let nonMonotonicSegments = 0;

  for (let index = 1; index < tree.trunk.points.length; index += 1) {
    if (tree.trunk.points[index].y <= tree.trunk.points[index - 1].y) {
      nonMonotonicSegments += 1;
    }
  }

  const top = tree.trunk.points.at(-1);
  const topDistance = Math.min(
    ...tree.lobes.map((lobe) => normalizedPointDistance(top, lobe)),
  );

  return {
    nonMonotonicTrunkSegments: nonMonotonicSegments,
    trunkTopFoliageDistance: topDistance,
  };
}

export function analyzeTopology(tree) {
  const adjacency = createAdjacency(tree.lobes);
  const isolatedLobes = adjacency.filter(
    (neighbors) => neighbors.length === 0,
  ).length;

  return {
    lobeComponentCount: countComponents(adjacency),
    isolatedLobeCount: isolatedLobes,
    ...analyzeBranches(tree),
    ...analyzeTrunk(tree),
  };
}
