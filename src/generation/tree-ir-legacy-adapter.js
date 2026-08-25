import { TREE_IR_ROOT_STEM_ID } from './tree-ir-schema.js';
import { validateTreeIr } from './tree-ir-validator.js';

function copyPoint(point) {
  return Object.freeze({ x: point.x, y: point.y, z: point.z });
}

function reusePoint(point) {
  return Object.freeze(point);
}

function copyPath(path) {
  return Object.freeze(path.map(copyPoint));
}

function reusePath(path) {
  for (const point of path) reusePoint(point);
  return Object.freeze(path);
}

function legacyBranchId(stem) {
  return stem.metadata.legacy?.id;
}

function createTrunk(rootStem, reuseIrData) {
  const legacy = rootStem.metadata.legacy ?? {};
  return Object.freeze({
    points: reuseIrData ? reusePath(rootStem.path) : copyPath(rootStem.path),
    startRadius: rootStem.startRadius,
    endRadius: rootStem.endRadius,
    flare: legacy.flare,
    taperPower: rootStem.taperPower,
    nebari: legacy.nebari,
    style: legacy.style,
  });
}

function createBranches(ir, reuseIrData) {
  return Object.freeze(
    ir.stems
      .filter((stem) => stem.id !== TREE_IR_ROOT_STEM_ID)
      .filter((stem) => Number.isSafeInteger(legacyBranchId(stem)))
      .sort((left, right) => legacyBranchId(left) - legacyBranchId(right))
      .map((stem) => {
        const legacy = stem.metadata.legacy;
        return Object.freeze({
          id: legacy.id,
          parentId: legacy.parentId,
          order: stem.order,
          macroClumpId: legacy.macroClumpId,
          targetLobeId: legacy.targetLobeId,
          exposed: legacy.exposed,
          points: reuseIrData ? reusePath(stem.path) : copyPath(stem.path),
          startRadius: stem.startRadius,
          endRadius: stem.endRadius,
        });
      }),
  );
}

function createLobes(ir, branchByStemId, reuseIrData) {
  const point = reuseIrData ? reusePoint : copyPoint;
  return Object.freeze(
    [...ir.crownVolumes]
      .sort((left, right) => left.metadata.legacyId - right.metadata.legacyId)
      .map((volume) =>
        Object.freeze({
          id: volume.metadata.legacyId,
          macroClumpId: volume.macroClumpId,
          position: point(volume.center),
          scale: point(volume.scale),
          rotation: point(volume.rotation),
          colorMix: volume.colorMix,
          branchId: branchByStemId.get(volume.sourceStemId)?.id ?? null,
        }),
      ),
  );
}

function createShell(ir, reuseIrData) {
  return Object.freeze(
    [...ir.foliageSites]
      .sort((left, right) => left.metadata.render.id - right.metadata.render.id)
      .map((site) =>
        reuseIrData
          ? Object.freeze(site.metadata.render)
          : Object.freeze({ ...site.metadata.render }),
      ),
  );
}

function adaptValidatedTreeIr(ir, { reuseIrData = false } = {}) {
  const legacy = ir.metadata.legacy;
  if (!legacy) {
    throw new Error(`Tree IR '${ir.presetId}' has no legacy renderer metadata.`);
  }

  const rootStem = ir.stems.find((stem) => stem.id === ir.root.stemId);
  const trunk = createTrunk(rootStem, reuseIrData);
  const branches = createBranches(ir, reuseIrData);
  const branchByStemId = new Map(
    ir.stems
      .filter((stem) => Number.isSafeInteger(legacyBranchId(stem)))
      .map((stem) => [stem.id, stem.metadata.legacy]),
  );
  const lobes = createLobes(ir, branchByStemId, reuseIrData);
  const lobeExposure = [];
  for (const volume of ir.crownVolumes) {
    lobeExposure[volume.metadata.legacyId] = volume.exposure;
  }
  const shell = createShell(ir, reuseIrData);
  const tree = {
    presetId: ir.presetId,
    generationModel: ir.generationModel,
    seed: ir.seed,
    height: ir.height,
    crownProfile: legacy.crownProfile,
    crownCenter: legacy.crownCenter,
    continuity: legacy.continuity,
    lobes,
    lobeConnections: legacy.lobeConnections,
    lobeExposure: Object.freeze(lobeExposure),
    shell,
    shellCandidateCoverageRatio: legacy.shellCandidateCoverageRatio,
    shellCoverageDiagnostics: legacy.shellCoverageDiagnostics,
    trunk,
    branches,
    branchGraph: Object.freeze({ trunk, branches }),
    clumps: legacy.clumps,
    sprayRecords: shell,
    bounds: ir.bounds,
    palette: legacy.palette,
    trunkColor: legacy.trunkColor,
    barkPalette: legacy.barkPalette,
  };
  if (legacy.lodCostSummaries !== undefined) {
    tree.lodCostSummaries = legacy.lodCostSummaries;
  }
  return Object.freeze(tree);
}

export function adaptValidatedTreeIrToLegacyTreeData(ir) {
  return adaptValidatedTreeIr(ir, { reuseIrData: true });
}

export function adaptTreeIrToLegacyTreeData(ir) {
  validateTreeIr(ir);
  return adaptValidatedTreeIr(ir);
}
