import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeIrImpostorLayout } from '../src/rendering/tree-ir-impostor-layout.js';

const TREE_IR = Object.freeze({
  bounds: Object.freeze({
    minimum: Object.freeze({ x: -2, y: 0, z: -5 }),
    maximum: Object.freeze({ x: 2, y: 10, z: 5 }),
  }),
});

test('native impostor layout uses Tree IR bounds without legacy lobe data', () => {
  const layout = calculateTreeIrImpostorLayout(TREE_IR, 0, {
    textureSize: 100,
    paddingRatio: 0.1,
  });

  assert.equal(layout.width, 4);
  assert.equal(layout.height, 10);
  assert.equal(layout.worldSize, 12.5);
  assert.deepEqual(layout.anchor, { x: 0, y: 5, z: 0 });
  assert.deepEqual(layout.point({ x: -2, y: 0, z: 0 }), {
    x: 34,
    y: 90,
    depth: 0,
  });
  assert.deepEqual(layout.point({ x: 2, y: 10, z: 0 }), {
    x: 66,
    y: 10,
    depth: 0,
  });
});

test('native impostor layout rotates conservative bounds for capture framing', () => {
  const layout = calculateTreeIrImpostorLayout(TREE_IR, Math.PI / 2, {
    textureSize: 128,
    paddingRatio: 0.08,
  });

  assert.ok(Math.abs(layout.width - 10) < 1e-9);
  assert.equal(layout.height, 10);
  assert.ok(Math.abs(layout.anchor.x) < 1e-9);
  assert.equal(layout.anchor.y, 5);
  assert.ok(Math.abs(layout.anchor.z) < 1e-9);
});

test('native impostor layout validates required bounds and padding', () => {
  assert.throws(
    () => calculateTreeIrImpostorLayout({}, 0),
    /requires tree bounds/,
  );
  assert.throws(
    () => calculateTreeIrImpostorLayout(TREE_IR, 0, { paddingRatio: 0.5 }),
    /Invalid impostor padding ratio/,
  );
});
