import { lobeAxisAlignedExtents } from './lobe-geometry.js';
import { DEFAULT_TREE_GENERATION_MODEL } from './tree-generation-model.js';

export function createEmptyFoliageShell(lobes) {
  return {
    instances: [],
    lobeExposure: lobes.map(() => 1),
    maximumCandidateCoverageRatio: 0,
    coverageCertification: Object.freeze({
      maximumCoverageRatio: 0,
      certified: true,
      emergencyUsed: false,
      normalRepairCount: 0,
      emergencyRepairCount: 0,
      remainingHoleCount: 0,
      unresolvedTriangleCount: 0,
      maximumSubdivisionDepthReached: 0,
    }),
  };
}

function createClumpRecords(lobes, branches) {
  const terminalBranchIds = new Map();
  for (const branch of branches) {
    if (!terminalBranchIds.has(branch.macroClumpId)) {
      terminalBranchIds.set(branch.macroClumpId, []);
    }
    terminalBranchIds.get(branch.macroClumpId).push(branch.id);
  }

  const records = new Map();
  for (const lobe of lobes) {
    if (!records.has(lobe.macroClumpId)) {
      records.set(lobe.macroClumpId, {
        id: lobe.macroClumpId,
        lobeIds: [],
        branchIds: new Set(),
      });
    }
    const record = records.get(lobe.macroClumpId);
    record.lobeIds.push(lobe.id);
    record.branchIds.add(lobe.branchId);
  }

  return Object.freeze(
    [...records.values()].map((record) =>
      Object.freeze({
        id: record.id,
        lobeIds: Object.freeze(record.lobeIds),
        branchIds: Object.freeze([...record.branchIds]),
        terminalBranchIds: Object.freeze(terminalBranchIds.get(record.id) ?? []),
      }),
    ),
  );
}

function createBounds(height, lobes) {
  const minimum = { x: 0, y: 0, z: 0 };
  const maximum = { x: 0, y: height, z: 0 };
  for (const lobe of lobes) {
    const extent = lobeAxisAlignedExtents(lobe);
    minimum.x = Math.min(minimum.x, lobe.position.x - extent.x);
    minimum.y = Math.min(minimum.y, lobe.position.y - extent.y);
    minimum.z = Math.min(minimum.z, lobe.position.z - extent.z);
    maximum.x = Math.max(maximum.x, lobe.position.x + extent.x);
    maximum.y = Math.max(maximum.y, lobe.position.y + extent.y);
    maximum.z = Math.max(maximum.z, lobe.position.z + extent.z);
  }
  return Object.freeze({
    minimum: Object.freeze(minimum),
    maximum: Object.freeze(maximum),
  });
}

export function createLegacyTreeData({
  preset,
  seed,
  lobes,
  lobeConnections,
  shell,
  structure,
  crownCenter,
  lodCostAnalyzer = null,
  includeLodCostSummaries = false,
}) {
  const frozenTrunk = Object.freeze(structure.trunk);
  const frozenBranches = Object.freeze(structure.branches);
  const frozenShell = Object.freeze(shell.instances);
  const tree = {
    presetId: preset.id,
    generationModel: preset.generationModel ?? DEFAULT_TREE_GENERATION_MODEL,
    seed,
    height: preset.height,
    crownProfile: preset.crown.profile,
    crownCenter,
    continuity: preset.continuity ?? null,
    lobes: Object.freeze(lobes),
    lobeConnections,
    lobeExposure: Object.freeze(shell.lobeExposure),
    shell: frozenShell,
    shellCandidateCoverageRatio: shell.maximumCandidateCoverageRatio,
    shellCoverageDiagnostics: shell.coverageCertification,
    trunk: frozenTrunk,
    branches: frozenBranches,
    branchGraph: Object.freeze({
      trunk: frozenTrunk,
      branches: frozenBranches,
    }),
    clumps: createClumpRecords(lobes, structure.branches),
    sprayRecords: frozenShell,
    bounds: createBounds(preset.height, lobes),
    palette: preset.foliage,
    trunkColor: preset.trunk.color,
    barkPalette: preset.trunk.barkPalette,
  };

  if (includeLodCostSummaries) {
    if (typeof lodCostAnalyzer !== 'function') {
      throw new Error('LOD cost summaries require an injected analyzer.');
    }
    tree.lodCostSummaries = lodCostAnalyzer(tree);
  }

  return Object.freeze(tree);
}
