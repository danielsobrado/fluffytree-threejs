import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('leaf detail configuration is validated and frozen', () => {
  const preset = createTestPreset();

  assert.equal(preset.foliage.leafDetail.enabled, true);
  assert.equal(preset.foliage.leafDetail.leavesPerCluster, 5);
  assert.equal(preset.foliage.leafDetail.coreScale, 0.8);
  assert.equal(preset.foliage.leafDetail.layerCount, 4);
  assert.equal(preset.foliage.leafDetail.layerOffsetRatio, 0.16);
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

test('leaf detail rejects a full-size visible core', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          leafDetail: { coreScale: 1 },
        },
      }),
    /coreScale/,
  );
});

test('leaf detail limits shell layering', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          leafDetail: { layerCount: 5 },
        },
      }),
    /layerCount/,
  );
});
