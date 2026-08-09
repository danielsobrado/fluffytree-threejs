import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTransitionHoleThresholds } from '../src/qa/canopy-solidity-scale.js';

test('transition hole thresholds scale with the probe-to-runtime pixel ratio', () => {
  const thresholds = calculateTransitionHoleThresholds({
    minimumHolePixels: 16,
    minimumHoleRadius: 3,
    probeProjectedPixels: 210,
    targetProjectedPixels: 35,
  });

  assert.equal(thresholds.scale, 6);
  assert.equal(thresholds.minimumHoleRadius, 18);
  assert.equal(thresholds.minimumHolePixels, 576);
});

test('transition hole thresholds never become less strict than the base gate', () => {
  const thresholds = calculateTransitionHoleThresholds({
    minimumHolePixels: 16,
    minimumHoleRadius: 3,
    probeProjectedPixels: 200,
    targetProjectedPixels: 300,
  });

  assert.equal(thresholds.scale, 1);
  assert.equal(thresholds.minimumHoleRadius, 3);
  assert.equal(thresholds.minimumHolePixels, 16);
});
