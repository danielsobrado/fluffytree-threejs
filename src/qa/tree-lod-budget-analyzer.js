import { createFoliageCoreLayout } from '../rendering/foliage-core-layout.js';
import { resolveFoliageCoverageGuard } from '../rendering/foliage-coverage-guard-plan.js';
import { hashUnit } from '../rendering/deterministic-hash.js';
import { selectFoliageLodInstances } from '../rendering/foliage-lod-selector.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js';
import { resolveFoliageRepresentationProfile } from '../rendering/foliage-representation-policy.js';
import { selectHeroLeafSamples } from '../rendering/hero-leaf-style.js';
import { resolveLeafTriangleCountPerLeaf } from '../rendering/leaf-cluster-geometry-factory.js';

const INTERIOR_SHELL_SALT = 0x6c8e9cf5;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

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

function coreInstanceCount(tree, lodIndex) {
  return createFoliageCoreLayout(tree, {
    lodIndex,
    scaleMultiplier: FOLIAGE_RENDERING_CONSTANTS.coreScaleMultiplier,
  }).instances.length;
}

function roleValue(profile, role, key, fallback) {
  return profile?.[role]?.[key] ?? fallback;
}

function countInteriorShell(tree, outerInstances, density) {
  if (density <= 0) return 0;
  return outerInstances.filter(
    (instance) =>
      hashUnit(tree.seed, instance.id, INTERIOR_SHELL_SALT) <= density,
  ).length;
}

function analyzeShell(tree, density, planesPerCluster, interiorDensity = 0) {
  const selection = selectFoliageLodInstances(tree.shell, density, {
    renderedPlaneCount: planesPerCluster,
  });
  const outerInstances = selection.instances;
  const interiorInstanceCount = countInteriorShell(
    tree,
    outerInstances,
    interiorDensity,
  );
  const coverageGuard = resolveFoliageCoverageGuard(
    outerInstances,
    planesPerCluster,
  );
  const coverageGuardTriangles =
    coverageGuard.repairInstances.length * coverageGuard.planeCount * 2;
  const triangles =
    (outerInstances.length + interiorInstanceCount) *
      planesPerCluster *
      2 +
    coverageGuardTriangles;
  const hasShell = outerInstances.length > 0;
  const hasCoverageGuard =
    coverageGuard.repairInstances.length > 0 && coverageGuard.planeCount > 0;

  return Object.freeze({
    exteriorInstanceCount: outerInstances.length,
    interiorInstanceCount,
    coverageGuardInstanceCount: hasCoverageGuard
      ? coverageGuard.repairInstances.length
      : 0,
    triangles,
    drawCalls: (hasShell ? 1 : 0) + (hasCoverageGuard ? 1 : 0),
  });
}

function analyzeLeaves(tree, profile, role) {
  const foliage = tree.palette;
  const fallbackMultiplier = role === 'hero' ? 1 : 0;
  const multiplier = roleValue(
    profile,
    role,
    'leafDensityMultiplier',
    fallbackMultiplier,
  );
  const density = clamp01(foliage.heroLeaves.density * multiplier);
  const layerCount = roleValue(
    profile,
    role,
    'leafLayerCount',
    foliage.heroLeaves.layerCount,
  );
  const trianglesPerLeaf = resolveLeafTriangleCountPerLeaf(profile?.geometry);

  if (!foliage.heroLeaves.enabled || density <= 0 || tree.shell.length === 0) {
    return Object.freeze({
      sourceSampleCount: 0,
      clusterCount: 0,
      leafCount: 0,
      layerCount,
      density,
      trianglesPerLeaf,
      triangles: 0,
      drawCalls: 0,
    });
  }

  const sourceSampleCount = selectHeroLeafSamples(tree, density).length;
  const clusterCount = sourceSampleCount * layerCount;
  const leafCount = clusterCount * foliage.heroLeaves.leavesPerCluster;

  return Object.freeze({
    sourceSampleCount,
    clusterCount,
    leafCount,
    layerCount,
    density,
    trianglesPerLeaf,
    triangles: leafCount * trianglesPerLeaf,
    drawCalls: clusterCount > 0 ? 1 : 0,
  });
}

export function analyzeTreeLodBudgets(
  tree,
  { foliageRenderingPolicy = null } = {},
) {
  const foliage = tree.palette;
  const profile = resolveFoliageRepresentationProfile(
    foliageRenderingPolicy,
    foliage.leafShape,
  );
  const heroShell = analyzeShell(
    tree,
    roleValue(profile, 'hero', 'shellDensity', 1),
    foliage.shell.planesPerCluster,
    roleValue(
      profile,
      'hero',
      'shellInteriorDensity',
      FOLIAGE_RENDERING_CONSTANTS.heroInteriorDensity,
    ),
  );
  const nearShell = analyzeShell(
    tree,
    roleValue(
      profile,
      'near',
      'shellDensity',
      FOLIAGE_RENDERING_CONSTANTS.mediumShellDensity,
    ),
    1,
  );
  const heroLeaves = analyzeLeaves(tree, profile, 'hero');
  const nearLeaves = analyzeLeaves(tree, profile, 'near');
  const lod0CoreInstances = coreInstanceCount(tree, 0);
  const lod1CoreInstances = coreInstanceCount(tree, 1);
  const lod2CoreInstances = coreInstanceCount(tree, 2);
  const lobeCount = tree.lobes.length;
  const structureShadowTriangles = structureTriangles(tree, 1, 6, 8, 4);
  const lod0 =
    structureTriangles(tree, 3, 10, 24, 10) +
    lod0CoreInstances * 80 +
    heroShell.triangles +
    heroLeaves.triangles;
  const lod1 =
    structureTriangles(tree, 2, 8, 14, 7) +
    lod1CoreInstances * 80 +
    nearShell.triangles +
    nearLeaves.triangles;
  const lod2 =
    structureTriangles(tree, 1, 6, 8, 4) +
    lod2CoreInstances * 20;

  return Object.freeze({
    lodTriangles: Object.freeze([lod0, lod1, lod2, 2]),
    lodDrawCalls: Object.freeze([
      2 + heroShell.drawCalls + heroLeaves.drawCalls,
      2 + nearShell.drawCalls + nearLeaves.drawCalls,
      2,
      1,
    ]),
    shadowTriangles: lobeCount * 80 + structureShadowTriangles,
    heroLeafClusters: heroLeaves.clusterCount,
    nearLeafClusters: nearLeaves.clusterCount,
    heroLeafLayerCount: heroLeaves.layerCount,
    nearLeafLayerCount: nearLeaves.layerCount,
    leafTrianglesPerLeaf: heroLeaves.trianglesPerLeaf,
    shellClusters: tree.shell.length,
    heroShellClusters: heroShell.exteriorInstanceCount,
    nearShellClusters: nearShell.exteriorInstanceCount,
    interiorShellClusters: heroShell.interiorInstanceCount,
    heroCoverageGuardClusters: heroShell.coverageGuardInstanceCount,
    nearCoverageGuardClusters: nearShell.coverageGuardInstanceCount,
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
