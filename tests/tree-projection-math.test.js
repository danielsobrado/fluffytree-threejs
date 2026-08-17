import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCameraFocalPixels,
  calculateProjectedTreePixels,
  resolveTreeWorldScale,
} from '../src/rendering/tree-projection-math.js';

test('camera focal pixels use vertical field of view', () => {
  assert.ok(Math.abs(calculateCameraFocalPixels(90, 1000) - 500) < 1e-9);
});

test('projected tree size accounts for inherited world scale', () => {
  const worldScale = resolveTreeWorldScale({ x: -2, y: 0.5, z: 1.5 });

  assert.equal(worldScale, 2);
  assert.equal(calculateProjectedTreePixels(10, 20, 100, worldScale), 100);
  assert.equal(calculateProjectedTreePixels(10, 20, 100), 50);
});

test('zero world scale produces a culled projected size', () => {
  assert.equal(calculateProjectedTreePixels(10, 20, 100, 0), 0);
});

test('projection helpers reject invalid transform data', () => {
  assert.throws(
    () => resolveTreeWorldScale({ x: 1, y: Number.NaN, z: 1 }),
    /finite x, y, and z/,
  );
  assert.throws(
    () => calculateProjectedTreePixels(10, -1, 100, 1),
    /distance/,
  );
});
