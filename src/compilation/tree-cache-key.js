import { hashCanonicalValue } from '../core/canonical-value-hash.js?v=2.0.0-20260814.2';
import { TREE_IR_SCHEMA_VERSION } from '../generation/tree-ir-schema.js?v=2.0.0-20260814.2';

export const TREE_REPRESENTATION_COMPILER_VERSION = 1;

export function createTreeIrCacheKey({
  preset,
  seed,
  generationOptions = {},
  environmentSignature = null,
  schemaVersion = TREE_IR_SCHEMA_VERSION,
}) {
  if (!preset || typeof preset !== 'object') {
    throw new TypeError('Tree IR cache key requires a preset.');
  }
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new RangeError('Tree IR cache seed must be an unsigned 32-bit integer.');
  }

  return [
    `tree-ir-v${schemaVersion}`,
    preset.generationModel ?? 'crown-lobe',
    preset.id ?? 'tree',
    seed,
    hashCanonicalValue(preset),
    hashCanonicalValue(generationOptions),
    hashCanonicalValue(environmentSignature),
  ].join(':');
}

export function createRepresentationCacheKey({
  treeIr,
  role,
  qualityProfile,
  compilerVersion = TREE_REPRESENTATION_COMPILER_VERSION,
}) {
  if (!treeIr || typeof treeIr !== 'object') {
    throw new TypeError('Representation cache key requires Tree IR.');
  }
  if (typeof role !== 'string' || role === '') {
    throw new TypeError('Representation cache key requires a role.');
  }

  return [
    `tree-representation-v${compilerVersion}`,
    role,
    hashCanonicalValue(treeIr),
    hashCanonicalValue(qualityProfile),
  ].join(':');
}
