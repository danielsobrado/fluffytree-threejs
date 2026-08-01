import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreePreset } from '../src/domain/tree-preset.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';

const preset = createTreePreset('test', {
  label: 'Test',
  height: 7,
  crown: {
    profile: 'round',
    baseHeight: 2.2,
    height: 4.5,
    radius: 2.4,
    lobeCount: 10,
    lobeScale: [0.8, 1.1],
    verticalScale: [0.8, 1.2],
    radialBias: 0.6,
    asymmetry: 0.15,
    lean: [0.1, 0],
  },
  trunk: {
    baseRadius: 0.35,
    topRadius: 0.12,
    bend: 0.2,
    segments: 7,
    branchCount: 5,
    color: '#554433',
  },
  foliage: {
    baseColor: '#335533',
    lightColor: '#88aa66',
    variation: 0.2,
  },
});

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
});

test('generated tree respects requested topology counts', () => {
  const tree = new TreeGenerator().generate(preset, 44);
  assert.equal(tree.lobes.length, preset.crown.lobeCount);
  assert.equal(tree.branches.length, preset.trunk.branchCount);
  assert.equal(tree.trunk.points.length, preset.trunk.segments + 1);
});
