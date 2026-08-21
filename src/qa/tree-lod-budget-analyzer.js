import { createFoliageCoreLayout } from '../rendering/foliage-core-layout.js?v=2.0.0-20260814.2';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js?v=2.0.0-20260814.2';
import { hashUnit } from '../rendering/deterministic-hash.js?v=2.0.0-20260814.2';
import { selectFoliageLodInstances } from '../rendering/foliage-lod-selector.js?v=2.0.0-20260814.2';

function countBranches(tree, maximumOrder) {
  return tree.branches.filter((branch) => branch.order <= maximumOrder);
}

function structureTriangles(
  tree,
  maximumOrder,
  radialSegments,
  trunkSamples,
  branchSamples,
) {
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

function coreInstanceCount(tree, lodIndex) {
  return createFoliageCoreLayout(tree, {
    lodIndex,
    scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier,
  }).instances.length;
}

export function analyzeTreeLodBudgets(tree) {
  const foliage = tree.palette;
  const heroClusters = selectedShellCount(
    tree,
    foliage.heroLeaves.density,
    0x9e3779b1,
  );
  const interiorShell = selectedShellCount(
    tree,
    FOLIAGE_RENDERING_CONSTANTS.heroInteriorDensity,
    0x6c8e9cf5,
  );
  const mediumShell = selectFoliageLodInstances(
    tree.shell,
    FOLIAGE_RENDERING_CONSTANTS.mediumShellDensity,
  ).instances.length;
  const lod0CoreInstances = coreInstanceCount(tree, 0);
  const lod1CoreInstances = coreInstanceCount(tree, 1);
  const lod2CoreInstances = coreInstanceCount(tree, 2);
  const lobeCount = tree.lobes.length;
  const structureShadowTriangles = structureTriangles(tree, 1, 6, 8, 4);
  const lod0 =
    structureTriangles(tree, 3, 10, 24, 10) +
    lod0CoreInstances * 80 +
    (tree.shell.length + interiorShell) * foliage.shell.planesPerCluster * 2 +
    heroClusters * foliage.heroLeaves.leavesPerCluster * 2;
  const lod1 =
    structureTriangles(tree, 2, 8, 14, 7) +
    lod1CoreInstances * 80 +
    mediumShell * 2;
  const lod2 =
    structureTriangles(tree, 1, 6, 8, 4) +
    lod2CoreInstances * 20;

  return Object.freeze({
    lodTriangles: Object.freeze([lod0, lod1, lod2, 2]),
    lodDrawCalls: Object.freeze([4, 3, 2, 1]),
    shadowTriangles: lobeCount * 80 + structureShadowTriangles,
    heroLeafClusters: heroClusters,
    shellClusters: tree.shell.length,
    interiorShellClusters: interiorShell,
    coreBridgeInstances: Object.freeze([
      lod0CoreInstances - lobeCount,
      lod1CoreInstances - lobeCount,
      lod2CoreInstances - lobeCount,
    ]),
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
