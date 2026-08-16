import assert from 'node:assert/strict';
import test from 'node:test';
import { selectTreeIrFoliageSites } from '../src/rendering/tree-ir-foliage-selector.js';

const treeIr = Object.freeze({ seed: 12345 });
const sites = Object.freeze(
  Array.from({ length: 20 }, (_unused, index) =>
    Object.freeze({ id: `site:${index}` }),
  ),
);

test('direct IR foliage selection is deterministic and density bounded', () => {
  const first = selectTreeIrFoliageSites(treeIr, sites, 'near', 0.4);
  const second = selectTreeIrFoliageSites(treeIr, sites, 'near', 0.4);

  assert.deepEqual(first, second);
  assert.equal(first.length, 8);
  assert.equal(Object.isFrozen(first), true);
});

test('direct IR foliage selection preserves all and zero density endpoints', () => {
  assert.deepEqual(selectTreeIrFoliageSites(treeIr, sites, 'hero', 1), sites);
  assert.deepEqual(selectTreeIrFoliageSites(treeIr, sites, 'aggregate', 0), []);
});

test('direct IR foliage selection keeps a representation for sparse density', () => {
  assert.equal(selectTreeIrFoliageSites(treeIr, sites, 'near', 0.001).length, 1);
  assert.throws(
    () => selectTreeIrFoliageSites(treeIr, sites, 'near', 2),
    /within \[0, 1\]/,
  );
});
