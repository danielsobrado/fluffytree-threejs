import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateRootButtressScale,
  calculateRootFlareScale,
  extendPathBelowGround,
  getRootBaseHeight,
  getRootFlareTopHeight,
} from '../src/rendering/root-flare-profile.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from '../src/rendering/tree-structure-rendering-constants.js';

const FLARE = 0.45;
const TRUNK_PATH = Object.freeze([
  Object.freeze({ x: 0, y: 0, z: -0.02 }),
  Object.freeze({ x: 0.09, y: 0.62, z: 0.01 }),
  Object.freeze({ x: 0.2, y: 1.23, z: 0.05 }),
]);

test('the sweep starts below the terrain and merges above it', () => {
  assert.ok(getRootBaseHeight() < 0);
  assert.ok(getRootFlareTopHeight() > 0);
});

test('the flare widens monotonically towards the ground', () => {
  let previous = 0;

  for (const height of [1.2, getRootFlareTopHeight(), 0.6, 0.3, 0, getRootBaseHeight()]) {
    const scale = calculateRootFlareScale(FLARE, height);
    assert.ok(scale >= previous, `scale fell at height ${height}`);
    previous = scale;
  }

  assert.equal(calculateRootFlareScale(FLARE, getRootFlareTopHeight()), 1);
  assert.equal(calculateRootFlareScale(FLARE, 4), 1);
  assert.ok(
    Math.abs(
      calculateRootFlareScale(FLARE, getRootBaseHeight()) -
        (1 + FLARE * TREE_STRUCTURE_RENDERING_CONSTANTS.rootFlareStrength),
    ) < 1e-12,
  );
});

test('a flare of zero leaves the trunk radius untouched', () => {
  for (const height of [getRootBaseHeight(), 0, 0.4, 2]) {
    assert.equal(calculateRootFlareScale(0, height), 1);
  }
});

test('buttresses never push the merged end of the flare outwards', () => {
  for (let segment = 0; segment < 24; segment += 1) {
    const angle = (segment / 24) * Math.PI * 2;
    assert.equal(
      calculateRootButtressScale(angle, getRootFlareTopHeight(), 104729),
      1,
    );
    assert.ok(calculateRootButtressScale(angle, 0.15, 104729) >= 1);
  }
});

test('the path is extended below the terrain along its own direction', () => {
  const extended = extendPathBelowGround(TRUNK_PATH);

  assert.equal(extended.length, TRUNK_PATH.length + 1);
  assert.equal(extended[0].y, getRootBaseHeight());
  assert.deepEqual(
    extended.slice(1).map((point) => point.y),
    TRUNK_PATH.map((point) => point.y),
  );

  const extensionSlope =
    (extended[1].x - extended[0].x) / (extended[1].y - extended[0].y);
  const trunkSlope =
    (TRUNK_PATH[1].x - TRUNK_PATH[0].x) / (TRUNK_PATH[1].y - TRUNK_PATH[0].y);
  assert.ok(Math.abs(extensionSlope - trunkSlope) < 1e-9);
});

test('a descending or short trunk path is rejected', () => {
  assert.throws(() => extendPathBelowGround([{ x: 0, y: 0, z: 0 }]), /three points/);
  assert.throws(
    () =>
      extendPathBelowGround([
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 1, z: 0 },
      ]),
    /ascend/,
  );
});
