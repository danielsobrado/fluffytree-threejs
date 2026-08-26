import assert from 'node:assert/strict';
import test from 'node:test';
import { ColliderSpatialIndex } from '../src/controls/collider-spatial-index.js';

test('collider index returns only nearby buckets without duplicates', () => {
  const near = { x: 1, z: 1, radius: 1 };
  const boundary = { x: 4.1, z: 1, radius: 1.5 };
  const far = { x: 30, z: 30, radius: 2 };
  const index = new ColliderSpatialIndex({ cellSize: 4 });
  index.rebuild([near, boundary, far]);

  const result = index.query(2.9, 1, 0.4);
  assert.deepEqual(new Set(result), new Set([near, boundary]));
  assert.equal(result.length, 2);
});

test('collider index rebuild replaces old scene colliders', () => {
  const index = new ColliderSpatialIndex({ cellSize: 4 });
  index.rebuild([{ x: 0, z: 0, radius: 1 }]);
  assert.equal(index.query(0, 0).length, 1);

  const replacement = { x: 20, z: 20, radius: 1 };
  index.rebuild([replacement]);
  assert.equal(index.query(0, 0).length, 0);
  assert.deepEqual(index.query(20, 20), [replacement]);
});
