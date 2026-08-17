import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeBillboardWorldSize } from '../src/rendering/tree-billboard-scale.js';

test('billboard world size includes inherited horizontal and vertical scale', () => {
  assert.deepEqual(
    calculateTreeBillboardWorldSize(
      { x: 12, y: 12, z: 1 },
      { x: 1.5, y: 0.75, z: 2 },
    ),
    { x: 24, y: 9 },
  );
});

test('billboard world size handles mirrored tree transforms', () => {
  assert.deepEqual(
    calculateTreeBillboardWorldSize(
      { x: 10, y: 8, z: 1 },
      { x: -2, y: -3, z: 1.25 },
    ),
    { x: 20, y: 24 },
  );
});

test('billboard world size rejects invalid transforms', () => {
  assert.throws(
    () =>
      calculateTreeBillboardWorldSize(
        { x: 1, y: 1, z: 1 },
        { x: 1, y: Number.NaN, z: 1 },
      ),
    /finite x, y, and z/,
  );
});
