import assert from 'node:assert/strict';
import test from 'node:test';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('hero leaves, core, clumps, and branching are validated and frozen', () => {
  const preset = createTestPreset();

  assert.equal(preset.foliage.heroLeaves.enabled, true);
  assert.equal(preset.foliage.heroLeaves.leavesPerCluster, 5);
  assert.equal(preset.foliage.heroLeaves.layerCount, 4);
  assert.equal(preset.foliage.core.scale, 0.8);
  assert.equal(Object.isFrozen(preset.foliage.heroLeaves), true);
  assert.equal(Object.isFrozen(preset.foliage.core), true);
  assert.equal(preset.crown.clumps.macroCount, 4);
  assert.equal(preset.trunk.branching.depth, 3);
  assert.equal(Object.isFrozen(preset.crown.clumps), true);
  assert.equal(Object.isFrozen(preset.trunk.branching), true);
  assert.equal(Object.isFrozen(preset.trunk.barkPalette), true);
});

test('hero leaf density rejects values outside the normalized range', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          heroLeaves: { density: 1.1 },
        },
      }),
    /heroLeaves\.density/,
  );
});

test('hero leaves require a positive leaf count', () => {
  assert.throws(
    () =>
      createTestPreset({
        foliage: {
          heroLeaves: { leavesPerCluster: 0 },
        },
      }),
    /leavesPerCluster/,
  );
});
