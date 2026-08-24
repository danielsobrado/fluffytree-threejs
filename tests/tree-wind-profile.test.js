import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateTreeWindBoundsPadding,
  TREE_WIND_PROFILE,
} from '../src/animation/tree-wind-profile.js';

test('wind bounds cover the full two-sided shader oscillation', () => {
  const strength = 0.2;
  const maximumPrimary = strength * TREE_WIND_PROFILE.maximumOscillationDelta;
  const maximumSecondary =
    maximumPrimary * TREE_WIND_PROFILE.secondaryStrengthRatio;

  assert.ok(
    Math.abs(
      calculateTreeWindBoundsPadding(strength) -
        Math.hypot(maximumPrimary, maximumSecondary),
    ) < 1e-12,
  );
});
