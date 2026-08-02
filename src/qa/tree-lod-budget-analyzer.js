import { hashUnit } from '../rendering/deterministic-hash.js';

function countBranches(tree, maximumOrder) {
  return tree.branches.filter((branch) => branch.order <= maximumOrder);
}

function structureTriangles(tree, maximumOrder, radialSegments, trunkSamples, branchSamples) {
  const branches = countBranches(tree, maximumOrder);
  const caps = branches.filter((branch) => branch.exposed).length * radialSegments;
  return (
    trunkSamples * radialSegments * 2 +
    radialSegments * 2 +
    branches.length * branchSamples * radialSegments * 2 +
    caps
  );
}

function selectedShellCount(tree, density, salt) {
  return tree.shell.filter(
    (sample) => hashUnit(tree.seed, sample.id, salt) <= density,
  ).length;
}

export function analyzeTreeLodBudgets(tree) {
  const foliage = tree.palette;
  const heroClusters = selectedShellCount(tree, foliage.heroLeaves.density, 0x9e3779b1);
  const interiorShell = selectedShellCount(tree, 0.3, 0x6c8e9cf5);
  const mediumShell = selectedShellCount(tree, 0.7, 0x517cc1b7);
  const lobeCount = tree.lobes.length;
  const lod0 =
    structureTriangles(tree, 3, 10, 24, 10) +
    lobeCount * 80 +
    (tree.shell.length + interiorShell) * foliage.shell.planesPerCluster * 2 +
    heroClusters * foliage.heroLeaves.leavesPerCluster * 2;
  const lod1 =
    structureTriangles(tree, 2, 8, 14, 7) +
    lobeCount * 80 +
    mediumShell * 2;
  const lod2 = structureTriangles(tree, 1, 6, 8, 4) + lobeCount * 20;

  return Object.freeze({
    lodTriangles: Object.freeze([lod0, lod1, lod2, 2]),
    lodDrawCalls: Object.freeze([4, 3, 2, 1]),
    shadowTriangles: lobeCount * 80,
    heroLeafClusters: heroClusters,
    shellClusters: tree.shell.length,
    interiorShellClusters: interiorShell,
  });
}

export function evaluateTreeLodBudgets(metrics, budgets) {
  const failures = [];
  metrics.lodTriangles.forEach((triangles, index) => {
    if (triangles > budgets.maximumTriangles[index]) {
      failures.push({ metric: `lod${index}Triangles`, actual: triangles });
    }
  });
  metrics.lodDrawCalls.forEach((drawCalls, index) => {
    if (drawCalls > budgets.maximumDrawCalls[index]) {
      failures.push({ metric: `lod${index}DrawCalls`, actual: drawCalls });
    }
  });
  if (metrics.shadowTriangles > budgets.maximumShadowTriangles) {
    failures.push({ metric: 'shadowTriangles', actual: metrics.shadowTriangles });
  }
  return failures;
}
