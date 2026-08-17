import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLodWeights,
  calculateProjectedTreePixels,
  remapUnavailableLodWeights,
  resolveStableLod,
  resolveTreeWorldScale,
} from '../src/rendering/tree-lod-math.js';

const SETTINGS = Object.freeze({
  nearPixels: 300,
  mediumPixels: 110,
  farPixels: 35,
  cullPixels: 12,
  hysteresis: 0.12,
  fadeBand: 0.15,
});

test('LOD weights select every tier and preserve complementary transitions', () => {
  assert.deepEqual(calculateLodWeights(500, SETTINGS), [1, 0, 0, 0]);
  assert.deepEqual(calculateLodWeights(180, SETTINGS), [0, 1, 0, 0]);
  assert.deepEqual(calculateLodWeights(60, SETTINGS), [0, 0, 1, 0]);
  assert.deepEqual(calculateLodWeights(20, SETTINGS), [0, 0, 0, 1]);
  assert.deepEqual(calculateLodWeights(5, SETTINGS), [0, 0, 0, 0]);

  for (const threshold of [300, 110, 35]) {
    const weights = calculateLodWeights(threshold, SETTINGS);
    assert.ok(Math.abs(weights.reduce((sum, value) => sum + value, 0) - 1) < 1e-9);
    assert.equal(weights.filter((value) => value > 0).length, 2);
  }
});

test('LOD hysteresis prevents boundary flapping', () => {
  assert.equal(resolveStableLod(290, 0, SETTINGS), 0);
  assert.equal(resolveStableLod(250, 0, SETTINGS), 1);
  assert.equal(resolveStableLod(320, 1, SETTINGS), 1);
  assert.equal(resolveStableLod(340, 1, SETTINGS), 0);
});

test('unavailable levels collapse into the nearest built representation', () => {
  assert.deepEqual(
    remapUnavailableLodWeights([0.6, 0.4, 0, 0], {
      minimumLevel: 2,
      heroReady: false,
    }),
    [0, 0, 1, 0],
  );
  assert.deepEqual(
    remapUnavailableLodWeights([1, 0, 0, 0], {
      minimumLevel: 0,
      heroReady: false,
    }),
    [0, 1, 0, 0],
  );
});

test('LOD weights can reuse caller-owned buffers', () => {
  const weights = [9, 9, 9, 9];

  assert.equal(calculateLodWeights(300, SETTINGS, weights), weights);
  assert.deepEqual(weights, [0.5, 0.5, 0, 0]);
  assert.equal(
    remapUnavailableLodWeights(
      weights,
      { minimumLevel: 2, heroReady: false },
      weights,
    ),
    weights,
  );
  assert.deepEqual(weights, [0, 0, 1, 0]);
});

test('projected tree size accounts for inherited world scale', () => {
  const worldScale = resolveTreeWorldScale({ x: -2, y: 0.5, z: 1.5 });

  assert.equal(worldScale, 2);
  assert.equal(calculateProjectedTreePixels(10, 20, 100, worldScale), 100);
  assert.equal(calculateProjectedTreePixels(10, 20, 100, 1), 50);
});

test('tree projection helpers reject invalid transform data', () => {
  assert.throws(
    () => resolveTreeWorldScale({ x: 1, y: Number.NaN, z: 1 }),
    /finite x, y, and z/,
  );
  assert.throws(
    () => calculateProjectedTreePixels(10, -1, 100, 1),
    /distance/,
  );
});
