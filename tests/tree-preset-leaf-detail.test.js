import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('leaf detail and volumetric closure configuration are validated and frozen', () => {
  const preset = createTestPreset();

  assert.equal(preset.foliage.leafDetail.enabled, true);
  assert.equal(preset.foliage.leafDetail.leavesPerCluster, 5);
  assert.equal(preset.foliage.leafDetail.coreScale, 0.8);
  assert.equal(preset.foliage.leafDetail.layerCount, 4);
  assert.equal(preset.foliage.leafDetail.closure.volumeSlices, 12);
  assert.equal(preset.foliage.leafDetail.closure.microLayerCount, 2);
  assert.equal(Object.isFrozen(preset.foliage.leafDetail.closure), true);
  assert.equal(Object.isFrozen(preset.foliage.leafDetail), true);
});

test('leaf detail density rejects values outside the normalized range', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          leafDetail: { density: 1.1 },
        },
      }),
    /leafDetail\.density/,
  );
});

test('leaf detail requires a positive leaf count', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          leafDetail: { leavesPerCluster: 0 },
        },
      }),
    /leavesPerCluster/,
  );
});

test('closure rejects an unsafe trunk radius', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          leafDetail: { closure: { trunkRadiusRatio: 0.8 } },
        },
      }),
    /trunkRadiusRatio/,
  );
});

test('closure requires at least one micro layer', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          leafDetail: { closure: { microLayerCount: 0 } },
        },
      }),
    /microLayerCount/,
  );
});
