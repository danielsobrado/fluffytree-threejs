export const TREE_IR_SCHEMA_VERSION = 1;
export const TREE_IR_ROOT_STEM_ID = 'stem:root';

export const FOLIAGE_PRIMITIVE_FAMILIES = Object.freeze({
  BROADLEAF: 'broadleaf',
  NEEDLE_CLUSTER: 'needle-cluster',
  FROND: 'frond',
  COMPOUND_LEAF: 'compound-leaf',
  SPRAY: 'spray',
  GENERIC_CLUSTER: 'generic-cluster',
  FLOWER_FRUIT: 'flower-fruit',
  NONE: 'none',
});

export const FOLIAGE_PRIMITIVE_FAMILY_IDS = Object.freeze(
  Object.values(FOLIAGE_PRIMITIVE_FAMILIES),
);

export function resolveFoliagePrimitiveFamily(leafShape) {
  return leafShape === 'needle'
    ? FOLIAGE_PRIMITIVE_FAMILIES.NEEDLE_CLUSTER
    : FOLIAGE_PRIMITIVE_FAMILIES.BROADLEAF;
}
