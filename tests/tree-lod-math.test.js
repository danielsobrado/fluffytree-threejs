import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateLodWeights,
  remapUnavailableLodWeights,
  resolveStableLod,
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
