import assert from 'node:assert/strict';
import test from 'node:test';
import { FOLIAGE_PRIMITIVE_FAMILIES } from '../src/generation/tree-ir-schema.js';
import {
  hasTreeIrFoliageFamily,
  resolveTreeIrFamilyFoliageDensity,
  shouldBuildTreeIrFoliage,
} from '../src/rendering/tree-ir-foliage-lod-policy.js';
import { TREE_REPRESENTATION_ROLES } from '../src/rendering/tree-representation-role.js';

const CONFIG = Object.freeze({ frondAggregateDensity: 0.72 });
const MIXED_TREE = Object.freeze({
  foliageSites: Object.freeze([
    Object.freeze({ primitiveFamily: FOLIAGE_PRIMITIVE_FAMILIES.FROND }),
    Object.freeze({ primitiveFamily: FOLIAGE_PRIMITIVE_FAMILIES.BROADLEAF }),
  ]),
});

test('mixed-family trees retain aggregate frond foliage', () => {
  assert.equal(
    hasTreeIrFoliageFamily(MIXED_TREE, FOLIAGE_PRIMITIVE_FAMILIES.FROND),
    true,
  );
  assert.equal(
    shouldBuildTreeIrFoliage(
      MIXED_TREE,
      TREE_REPRESENTATION_ROLES.AGGREGATE,
      0,
    ),
    true,
  );
  assert.equal(
    resolveTreeIrFamilyFoliageDensity(
      FOLIAGE_PRIMITIVE_FAMILIES.FROND,
      TREE_REPRESENTATION_ROLES.AGGREGATE,
      0,
      CONFIG,
    ),
    0.72,
  );
});

test('aggregate non-frond families remain represented by crown volumes', () => {
  assert.equal(
    resolveTreeIrFamilyFoliageDensity(
      FOLIAGE_PRIMITIVE_FAMILIES.BROADLEAF,
      TREE_REPRESENTATION_ROLES.AGGREGATE,
      0.8,
      CONFIG,
    ),
    0,
  );
});

test('hero and near roles preserve requested family density', () => {
  assert.equal(
    resolveTreeIrFamilyFoliageDensity(
      FOLIAGE_PRIMITIVE_FAMILIES.FROND,
      TREE_REPRESENTATION_ROLES.NEAR,
      0.58,
      CONFIG,
    ),
    0.58,
  );
  assert.equal(
    shouldBuildTreeIrFoliage(
      MIXED_TREE,
      TREE_REPRESENTATION_ROLES.HERO,
      0,
    ),
    false,
  );
});
