import assert from 'node:assert/strict';
import test from 'node:test';
import {
  treeIrStyleSigned,
  treeIrStyleUnit,
} from '../src/rendering/tree-ir-style-random.js';

test('native tree style variation is deterministic and channel independent', () => {
  const treeIr = { seed: 71237 };
  const first = treeIrStyleUnit(treeIr, 'foliage:4', 'width');
  const second = treeIrStyleUnit(treeIr, 'foliage:4', 'width');
  const other = treeIrStyleUnit(treeIr, 'foliage:4', 'height');

  assert.equal(first, second);
  assert.ok(first >= 0 && first < 1);
  assert.notEqual(first, other);
});

test('signed native tree style variation stays within unit bounds', () => {
  const value = treeIrStyleSigned({ seed: 91 }, 'crown:2', 'scale-x');

  assert.ok(value >= -1 && value < 1);
});
