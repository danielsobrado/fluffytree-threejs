import {
  createPathAttachmentFrame,
  createTreeIrFrame,
} from './tree-ir-frame.js?v=2.0.0-20260814.2';
import {
  resolveFoliagePrimitiveFamily,
  TREE_IR_ROOT_STEM_ID,
  TREE_IR_SCHEMA_VERSION,
} from './tree-ir-schema.js?v=2.0.0-20260814.2';
import { validateTreeIr } from './tree-ir-validator.js?v=2.0.0-20260814.2';

function stemId(branchId) {
  return branchId === null || branchId === undefined
    ? TREE_IR_ROOT_STEM_ID
    : `stem:${branchId}`;
}

function windNodeId(stemIdentifier) {
  return `wind:${stemIdentifier}`;
}

function clonePoint(point) {
  return {
    x: Object.is(Number(point.x), -0) ? 0 : Number(point.x),
    y: Object.is(Number(point.y), -0) ? 0 : Number(point.y),
    z: Object.is(Number(point.z), -0) ? 0 : Number(point.z),
  };
}

function createStemRecords(treeData) {
  const root = {
    id: TREE_IR_ROOT_STEM_ID,
    parentId: null,
    order: 0,
    attachmentFrame: createPathAttachmentFrame(treeData.trunk.points),
    path: treeData.trunk.points.map(clonePoint),
    startRadius: treeData.trunk.startRadius,
    endRadius: treeData.trunk.endRadius,
    taperPower: treeData.trunk.taperPower ?? 1,
    exposedTip: false,
    age: 1,
    importance: 1,
    windNodeId: windNodeId(TREE_IR_ROOT_STEM_ID),
    metadata: {
      kind: 'trunk',
      legacy: {
        flare: treeData.trunk.flare,
        nebari: treeData.trunk.nebari,
        style: treeData.trunk.style,
      },
    },
  };

  const branches = treeData.branches.map((branch) => ({
    id: stemId(branch.id),
    parentId: stemId(branch.parentId),
    order: branch.order,
    attachmentFrame: createPathAttachmentFrame(branch.points),
    path: branch.points.map(clonePoint),
    startRadius: branch.startRadius,
    endRadius: branch.endRadius,
    taperPower: 1,
    exposedTip: Boolean(branch.exposed),
    age: Math.max(0, 1 - branch.order * 0.14),
    importance: 1 / (branch.order + 1),
    windNodeId: windNodeId(stemId(branch.id)),
    metadata: {
      kind: 'branch',
      legacy: {
        id: branch.id,
        parentId: branch.parentId,
        macroClumpId: branch.macroClumpId,
        targetLobeId: branch.targetLobeId,
        exposed: Boolean(branch.exposed),
      },
    },
  }));

  return [root, ...branches];
}

function createCrownVolumes(treeData) {
  return treeData.lobes.map((lobe) => ({
    id: `crown:${lobe.id}`,
    sourceStemId: stemId(lobe.branchId),
    center: clonePoint(lobe.position),
    scale: clonePoint(lobe.scale),
    rotation: clonePoint(lobe.rotation),
    density: 1,
    exposure: treeData.lobeExposure[lobe.id] ?? 0,
    macroClumpId: lobe.macroClumpId,
    colorMix: lobe.colorMix,
    importance: Math.max(0.05, treeData.lobeExposure[lobe.id] ?? 0),
    metadata: { legacyId: lobe.id },
  }));
}

function isPlainDataObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toCanonicalRenderValue(value) {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return value;
  if (type === 'number') {
    if (!Number.isFinite(value)) return Number.MAX_VALUE;
    return Object.is(value, -0) ? 0 : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => {
      const converted = toCanonicalRenderValue(entry);
      return converted === undefined ? null : converted;
    });
  }
  if (!isPlainDataObject(value)) return undefined;

  const result = {};
  for (const key of Object.keys(value)) {
    if (key === 'alphaProfile') continue;
    const converted = toCanonicalRenderValue(value[key]);
    if (converted !== undefined) result[key] = converted;
  }
  return result;
}

function createRenderableInstance(instance) {
  return toCanonicalRenderValue(instance);
}

function createFoliageSites(treeData, volumeByLegacyId) {
  return treeData.shell.map((instance) => {
    const volume = volumeByLegacyId.get(instance.lobeId);
    const parentStemId = volume?.sourceStemId ?? TREE_IR_ROOT_STEM_ID;
    return {
      id: `foliage:${instance.id}`,
      parentStemId,
      frame: createTreeIrFrame(instance.position, instance.normal),
      branchPosition: 1,
      exposure: instance.exposure,
      age: 1,
      vigor: 1,
      lightFactor: instance.exposure,
      densityPotential: 1,
      primitiveFamily: resolveFoliagePrimitiveFamily(instance.leafShape),
      importance: Math.max(0.05, instance.exposure),
      metadata: {
        lobeId: instance.lobeId,
        render: createRenderableInstance(instance),
      },
    };
  });
}

function createFoliageGroups(treeData, sites, volumes) {
  const sitesByLobe = new Map();
  for (const site of sites) {
    const lobeId = site.metadata.lobeId;
    const entries = sitesByLobe.get(lobeId) ?? [];
    entries.push(site.id);
    sitesByLobe.set(lobeId, entries);
  }
  const volumeByLegacyId = new Map(
    volumes.map((volume) => [volume.metadata.legacyId, volume]),
  );

  return treeData.clumps.map((clump) => ({
    id: `foliage-group:${clump.id}`,
    stemIds: clump.branchIds.map(stemId),
    crownVolumeIds: clump.lobeIds
      .map((lobeId) => volumeByLegacyId.get(lobeId)?.id)
      .filter(Boolean),
    foliageSiteIds: clump.lobeIds.flatMap(
      (lobeId) => sitesByLobe.get(lobeId) ?? [],
    ),
    metadata: { macroClumpId: clump.id },
  }));
}

function hashPhase(seed, value) {
  let hash = (Number(seed) ^ Math.imul(value + 1, 0x9e3779b1)) >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  return (hash >>> 0) / 0x100000000;
}

function createWindNodes(stems, seed) {
  return stems.map((stem, index) => ({
    id: stem.windNodeId,
    parentId: stem.parentId === null ? null : windNodeId(stem.parentId),
    phase: hashPhase(seed, index),
    stiffness: Math.max(0.1, 1 - stem.order * 0.2),
    damping: Math.min(1, 0.42 + stem.order * 0.08),
    massAreaProxy: Math.max(0.01, stem.startRadius * stem.startRadius),
  }));
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

export function createTreeIrFromLegacyTreeData(treeData) {
  const stems = createStemRecords(treeData);
  const crownVolumes = createCrownVolumes(treeData);
  const volumeByLegacyId = new Map(
    crownVolumes.map((volume) => [volume.metadata.legacyId, volume]),
  );
  const foliageSites = createFoliageSites(treeData, volumeByLegacyId);
  const legacy = {
    crownProfile: treeData.crownProfile,
    crownCenter: treeData.crownCenter,
    continuity: treeData.continuity,
    lobeConnections: treeData.lobeConnections,
    shellCandidateCoverageRatio: treeData.shellCandidateCoverageRatio,
    shellCoverageDiagnostics: treeData.shellCoverageDiagnostics,
    clumps: treeData.clumps,
    palette: treeData.palette,
    trunkColor: treeData.trunkColor,
    barkPalette: treeData.barkPalette,
  };
  if (treeData.lodCostSummaries !== undefined) {
    legacy.lodCostSummaries = treeData.lodCostSummaries;
  }
  const metadata = {
    legacy: toCanonicalRenderValue(legacy),
  };

  const ir = {
    schemaVersion: TREE_IR_SCHEMA_VERSION,
    presetId: treeData.presetId,
    generationModel: treeData.generationModel,
    seed: Number(treeData.seed) >>> 0,
    height: treeData.height,
    bounds: {
      minimum: clonePoint(treeData.bounds.minimum),
      maximum: clonePoint(treeData.bounds.maximum),
    },
    root: { stemId: TREE_IR_ROOT_STEM_ID },
    stems,
    foliageSites,
    foliageGroups: createFoliageGroups(treeData, foliageSites, crownVolumes),
    windNodes: createWindNodes(stems, treeData.seed),
    crownVolumes,
    metadata,
  };

  try {
    validateTreeIr(ir);
  } catch (error) {
    throw new TypeError(
      `${error.message} (${error.cause?.message ?? 'no cause'})`,
      { cause: error.cause },
    );
  }
  return deepFreeze(ir);
}
