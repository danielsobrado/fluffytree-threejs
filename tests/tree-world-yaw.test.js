import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeWorldYaw } from '../src/rendering/tree-world-yaw.js';

const EPSILON = 1e-12;

test('tree world yaw follows horizontal world-forward direction', () => {
  assert.ok(
    Math.abs(calculateTreeWorldYaw({ x: 1, z: 0 }) - Math.PI * 0.5) <=
      EPSILON,
  );
  assert.ok(
    Math.abs(Math.abs(calculateTreeWorldYaw({ x: 0, z: -1 })) - Math.PI) <=
      EPSILON,
  );
});

test('tree world yaw keeps fallback when forward is vertical', () => {
  assert.equal(calculateTreeWorldYaw({ x: 0, z: 0 }, 0.7), 0.7);
});
