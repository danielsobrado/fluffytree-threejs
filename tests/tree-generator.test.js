import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const preset = createTestPreset();

test('tree generation is deterministic for the same seed', () => {
  const generator = new TreeGenerator();
  const first = generator.generate(preset, 12345);
  const second = generator.generate(preset, 12345);
  assert.deepEqual(first, second);
});

test('tree generation changes with the seed', () => {
  const generator = new TreeGenerator();
  const first = generator.generate(preset, 12345);
  const second = generator.generate(preset, 12346);
  assert.notDeepEqual(first.lobes, second.lobes);
  assert.notDeepEqual(first.shell, second.shell);
});

test('generated tree respects requested topology counts', () => {
  const tree = new TreeGenerator().generate(preset, 44);
  assert.equal(tree.lobes.length, preset.crown.lobeCount);
  assert.equal(tree.branches.length, preset.trunk.branchCount);
  assert.equal(tree.trunk.points.length, preset.trunk.segments + 1);
  assert.equal(
    tree.shell.length,
    preset.crown.lobeCount * preset.foliage.shell.instancesPerLobe,
  );
  assert.equal(tree.lobeExposure.length, preset.crown.lobeCount);
});
