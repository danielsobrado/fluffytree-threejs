import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateRootCollarRadiusAtHeight,
  getRootCollarJoinHeight,
  getRootCollarMaximumHeight,
  getRootCollarMinimumHeight,
} from '../src/rendering/root-collar-profile.js';

const START_RADIUS = 0.36;
const FLARE = 0.45;

test('root collar surrounds the trunk across a positive overlap', () => {
  const joinHeight = getRootCollarJoinHeight();
  const maximumHeight = getRootCollarMaximumHeight();

  assert.ok(getRootCollarMinimumHeight() < 0);
  assert.ok(joinHeight > 0);
  assert.ok(maximumHeight > joinHeight);
});

test('root collar remains wider than the embedded trunk join', () => {
  const radius = calculateRootCollarRadiusAtHeight(
    START_RADIUS,
    FLARE,
    getRootCollarJoinHeight(),
  );

  assert.ok(radius > START_RADIUS);
  assert.ok(radius * 0.9 < radius);
});
