import { assertCanonicalValue } from '../core/canonical-value-hash.js';
import {
  FOLIAGE_PRIMITIVE_FAMILY_IDS,
  TREE_IR_SCHEMA_VERSION,
} from './tree-ir-schema.js';

function fail(path, message) {
  throw new Error(`Tree IR '${path}' ${message}.`);
}

function requireObject(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  return value;
}

function requireArray(value, path) {
  if (!Array.isArray(value)) fail(path, 'must be an array');
  return value;
}

function requireString(value, path) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(path, 'must be a non-empty string');
  }
  return value;
}

function requireFinite(value, path) {
  if (!Number.isFinite(value)) fail(path, 'must be a finite number');
  return value;
}

function requireNonNegative(value, path) {
  requireFinite(value, path);
  if (value < 0) fail(path, 'must be non-negative');
  return value;
}

function validateVector(value, path) {
  requireObject(value, path);
  requireFinite(value.x, `${path}.x`);
  requireFinite(value.y, `${path}.y`);
  requireFinite(value.z, `${path}.z`);
}

function validateFrame(value, path) {
  requireObject(value, path);
  validateVector(value.position, `${path}.position`);
  validateVector(value.tangent, `${path}.tangent`);
  validateVector(value.normal, `${path}.normal`);
  validateVector(value.binormal, `${path}.binormal`);
}

function validateBounds(bounds) {
  requireObject(bounds, 'bounds');
  validateVector(bounds.minimum, 'bounds.minimum');
  validateVector(bounds.maximum, 'bounds.maximum');
  for (const axis of ['x', 'y', 'z']) {
    if (bounds.minimum[axis] > bounds.maximum[axis]) {
      fail('bounds', `has minimum.${axis} greater than maximum.${axis}`);
    }
  }
}

function validateParentGraph(records, idPath, parentPath, label) {
  const byId = new Map(records.map((record) => [record[idPath], record]));
  for (const record of records) {
    const seen = new Set([record[idPath]]);
    let parentId = record[parentPath];
    while (parentId !== null) {
      const parent = byId.get(parentId);
      if (!parent) {
        fail(
          `${label}.${record[idPath]}.${parentPath}`,
          'references an unknown parent',
        );
      }
      if (seen.has(parentId)) fail(label, `contains a cycle at '${parentId}'`);
      seen.add(parentId);
      parentId = parent[parentPath];
    }
  }
}

function validateStems(ir) {
  const stems = requireArray(ir.stems, 'stems');
  if (stems.length === 0) fail('stems', 'must contain at least the root stem');
  const ids = new Set();
  for (const [index, stem] of stems.entries()) {
    const path = `stems[${index}]`;
    requireObject(stem, path);
    const id = requireString(stem.id, `${path}.id`);
    if (ids.has(id)) fail(`${path}.id`, `duplicates '${id}'`);
    ids.add(id);
    if (stem.parentId !== null) requireString(stem.parentId, `${path}.parentId`);
    if (!Number.isSafeInteger(stem.order) || stem.order < 0) {
      fail(`${path}.order`, 'must be a non-negative safe integer');
    }
    validateFrame(stem.attachmentFrame, `${path}.attachmentFrame`);
    const points = requireArray(stem.path, `${path}.path`);
    if (points.length < 2) {
      fail(`${path}.path`, 'must contain at least two points');
    }
    points.forEach((point, pointIndex) =>
      validateVector(point, `${path}.path[${pointIndex}]`),
    );
    if (requireFinite(stem.startRadius, `${path}.startRadius`) <= 0) {
      fail(`${path}.startRadius`, 'must be positive');
    }
    if (requireFinite(stem.endRadius, `${path}.endRadius`) <= 0) {
      fail(`${path}.endRadius`, 'must be positive');
    }
    requireFinite(stem.taperPower, `${path}.taperPower`);
    requireNonNegative(stem.age, `${path}.age`);
    requireNonNegative(stem.importance, `${path}.importance`);
    if (stem.windNodeId !== null) {
      requireString(stem.windNodeId, `${path}.windNodeId`);
    }
    requireObject(stem.metadata, `${path}.metadata`);
  }

  requireObject(ir.root, 'root');
  const rootStemId = requireString(ir.root.stemId, 'root.stemId');
  const rootStem = stems.find((stem) => stem.id === rootStemId);
  if (!rootStem) fail('root.stemId', 'references an unknown stem');
  if (rootStem.parentId !== null || rootStem.order !== 0) {
    fail('root.stemId', 'must reference an order-zero stem without a parent');
  }
  validateParentGraph(stems, 'id', 'parentId', 'stems');
  return ids;
}

function validateCrownVolumes(ir, stemIds) {
  const ids = new Set();
  for (const [index, volume] of requireArray(
    ir.crownVolumes,
    'crownVolumes',
  ).entries()) {
    const path = `crownVolumes[${index}]`;
    requireObject(volume, path);
    const id = requireString(volume.id, `${path}.id`);
    if (ids.has(id)) fail(`${path}.id`, `duplicates '${id}'`);
    ids.add(id);
    if (volume.sourceStemId !== null && !stemIds.has(volume.sourceStemId)) {
      fail(`${path}.sourceStemId`, 'references an unknown stem');
    }
    validateVector(volume.center, `${path}.center`);
    validateVector(volume.scale, `${path}.scale`);
    validateVector(volume.rotation, `${path}.rotation`);
    requireNonNegative(volume.density, `${path}.density`);
    requireNonNegative(volume.exposure, `${path}.exposure`);
    requireNonNegative(volume.importance, `${path}.importance`);
    requireObject(volume.metadata, `${path}.metadata`);
  }
  return ids;
}

function validateFoliageSites(ir, stemIds) {
  const ids = new Set();
  for (const [index, site] of requireArray(
    ir.foliageSites,
    'foliageSites',
  ).entries()) {
    const path = `foliageSites[${index}]`;
    requireObject(site, path);
    const id = requireString(site.id, `${path}.id`);
    if (ids.has(id)) fail(`${path}.id`, `duplicates '${id}'`);
    ids.add(id);
    if (!stemIds.has(site.parentStemId)) {
      fail(`${path}.parentStemId`, 'references an unknown stem');
    }
    validateFrame(site.frame, `${path}.frame`);
    const branchPosition = requireFinite(
      site.branchPosition,
      `${path}.branchPosition`,
    );
    if (branchPosition < 0 || branchPosition > 1) {
      fail(`${path}.branchPosition`, 'must be within [0, 1]');
    }
    for (const field of [
      'exposure',
      'age',
      'vigor',
      'lightFactor',
      'densityPotential',
      'importance',
    ]) {
      requireNonNegative(site[field], `${path}.${field}`);
    }
    if (!FOLIAGE_PRIMITIVE_FAMILY_IDS.includes(site.primitiveFamily)) {
      fail(`${path}.primitiveFamily`, 'is not supported');
    }
    if (site.windNodeId !== undefined && site.windNodeId !== null) {
      requireString(site.windNodeId, `${path}.windNodeId`);
    }
    requireObject(site.metadata, `${path}.metadata`);
  }
  return ids;
}

function validateFoliageGroups(ir, stemIds, volumeIds, siteIds) {
  const ids = new Set();
  for (const [index, group] of requireArray(
    ir.foliageGroups,
    'foliageGroups',
  ).entries()) {
    const path = `foliageGroups[${index}]`;
    requireObject(group, path);
    const id = requireString(group.id, `${path}.id`);
    if (ids.has(id)) fail(`${path}.id`, `duplicates '${id}'`);
    ids.add(id);
    requireArray(group.stemIds, `${path}.stemIds`).forEach((stemId) => {
      if (!stemIds.has(stemId)) {
        fail(`${path}.stemIds`, `references unknown stem '${stemId}'`);
      }
    });
    requireArray(group.crownVolumeIds, `${path}.crownVolumeIds`).forEach(
      (volumeId) => {
        if (!volumeIds.has(volumeId)) {
          fail(
            `${path}.crownVolumeIds`,
            `references unknown volume '${volumeId}'`,
          );
        }
      },
    );
    requireArray(group.foliageSiteIds, `${path}.foliageSiteIds`).forEach(
      (siteId) => {
        if (!siteIds.has(siteId)) {
          fail(
            `${path}.foliageSiteIds`,
            `references unknown site '${siteId}'`,
          );
        }
      },
    );
    requireObject(group.metadata, `${path}.metadata`);
  }
}

function validateWindNodes(ir) {
  const nodes = requireArray(ir.windNodes, 'windNodes');
  const ids = new Set();
  for (const [index, node] of nodes.entries()) {
    const path = `windNodes[${index}]`;
    requireObject(node, path);
    const id = requireString(node.id, `${path}.id`);
    if (ids.has(id)) fail(`${path}.id`, `duplicates '${id}'`);
    ids.add(id);
    if (node.parentId !== null) requireString(node.parentId, `${path}.parentId`);
    requireFinite(node.phase, `${path}.phase`);
    requireNonNegative(node.stiffness, `${path}.stiffness`);
    requireNonNegative(node.damping, `${path}.damping`);
    requireNonNegative(node.massAreaProxy, `${path}.massAreaProxy`);
  }
  validateParentGraph(nodes, 'id', 'parentId', 'windNodes');
  return ids;
}

function validateWindReferences(ir, windNodeIds) {
  for (const [index, stem] of ir.stems.entries()) {
    if (stem.windNodeId !== null && !windNodeIds.has(stem.windNodeId)) {
      fail(`stems[${index}].windNodeId`, 'references an unknown wind node');
    }
  }
  for (const [index, site] of ir.foliageSites.entries()) {
    if (
      site.windNodeId !== undefined &&
      site.windNodeId !== null &&
      !windNodeIds.has(site.windNodeId)
    ) {
      fail(`foliageSites[${index}].windNodeId`, 'references an unknown wind node');
    }
  }
}

export function validateTreeIr(ir) {
  requireObject(ir, 'rootValue');
  if (ir.schemaVersion !== TREE_IR_SCHEMA_VERSION) {
    fail('schemaVersion', `must equal ${TREE_IR_SCHEMA_VERSION}`);
  }
  requireString(ir.presetId, 'presetId');
  requireString(ir.generationModel, 'generationModel');
  if (!Number.isSafeInteger(ir.seed) || ir.seed < 0 || ir.seed > 0xffffffff) {
    fail('seed', 'must be an unsigned 32-bit integer');
  }
  if (requireFinite(ir.height, 'height') <= 0) fail('height', 'must be positive');
  validateBounds(ir.bounds);
  const stemIds = validateStems(ir);
  const volumeIds = validateCrownVolumes(ir, stemIds);
  const siteIds = validateFoliageSites(ir, stemIds);
  validateFoliageGroups(ir, stemIds, volumeIds, siteIds);
  const windNodeIds = validateWindNodes(ir);
  validateWindReferences(ir, windNodeIds);
  requireObject(ir.metadata, 'metadata');
  assertCanonicalValue(ir, 'Tree IR');
  return ir;
}
