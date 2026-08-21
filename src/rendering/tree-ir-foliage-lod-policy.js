import { FOLIAGE_PRIMITIVE_FAMILIES } from '../generation/tree-ir-schema.js?v=2.0.0-20260814.2';
import { TREE_REPRESENTATION_ROLES } from './tree-representation-role.js?v=2.0.0-20260814.2';

function requireDensity(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new RangeError(`${label} must be within [0, 1].`);
  }
  return value;
}

export function hasTreeIrFoliageFamily(treeIr, family) {
  return treeIr.foliageSites.some((site) => site.primitiveFamily === family);
}

export function resolveTreeIrFamilyFoliageDensity(
  family,
  role,
  requestedDensity,
  config,
) {
  if (role !== TREE_REPRESENTATION_ROLES.AGGREGATE) {
    return requireDensity(requestedDensity, 'Tree IR foliage density');
  }

  if (family !== FOLIAGE_PRIMITIVE_FAMILIES.FROND) return 0;
  return requireDensity(
    config.frondAggregateDensity,
    'Tree IR aggregate frond density',
  );
}

export function shouldBuildTreeIrFoliage(treeIr, role, requestedDensity) {
  if (role === TREE_REPRESENTATION_ROLES.AGGREGATE) {
    return hasTreeIrFoliageFamily(treeIr, FOLIAGE_PRIMITIVE_FAMILIES.FROND);
  }
  return requireDensity(requestedDensity, 'Tree IR foliage density') > 0;
}
