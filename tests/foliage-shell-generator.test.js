import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedRotatedPointDistance } from '../src/generation/lobe-geometry.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const NORMAL_TOLERANCE = 1e-9;

function groupByLobe(instances) {
  const groups = new Map();

  for (const instance of instances) {
    const group = groups.get(instance.lobeId) ?? [];
    group.push(instance);
    groups.set(instance.lobeId, group);
  }

  return groups;
}

test('foliage shell has an exact distributed count for every lobe', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 8128);
  const groups = groupByLobe(tree.shell);

  assert.equal(groups.size, tree.lobes.length);
  for (const lobe of tree.lobes) {
    assert.equal(
      groups.get(lobe.id)?.length,
      preset.foliage.shell.instancesPerLobe,
    );
  }
});

test('foliage shell fins sit outside their source lobe with valid dimensions', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 9981);

  for (const instance of tree.shell) {
    const lobe = tree.lobes.find((candidate) => candidate.id === instance.lobeId);
    assert.ok(lobe);

    const surfaceDistance = normalizedRotatedPointDistance(instance.position, lobe);
    assert.ok(surfaceDistance > 1);
    assert.ok(surfaceDistance < 1.2);

    const normalLength = Math.hypot(
      instance.normal.x,
      instance.normal.y,
      instance.normal.z,
    );
    assert.ok(Math.abs(normalLength - 1) <= NORMAL_TOLERANCE);
    assert.ok(instance.exposure >= 0 && instance.exposure <= 1);
    assert.ok(instance.colorMix >= 0 && instance.colorMix <= 1);
    assert.ok(instance.scale > 0);
    assert.ok(instance.widthRatio >= preset.foliage.shell.widthRatio[0]);
    assert.ok(instance.widthRatio <= preset.foliage.shell.widthRatio[1]);
    assert.ok(instance.outwardRatio >= preset.foliage.shell.outwardRatio[0]);
    assert.ok(instance.outwardRatio <= preset.foliage.shell.outwardRatio[1]);
    assert.ok(
      Math.abs(instance.colorMix - lobe.colorMix) <=
        preset.foliage.shell.colorJitter + Number.EPSILON,
    );
  }
});

test('foliage shell uses a seed stream independent from phase 1 geometry', () => {
  const preset = createTestPreset();
  const generator = new TreeGenerator();
  const tree = generator.generate(preset, 4401);
  const replay = generator.generate(preset, 4401);

  assert.deepEqual(tree.lobes, replay.lobes);
  assert.deepEqual(tree.branches, replay.branches);
  assert.deepEqual(tree.shell, replay.shell);
  assert.deepEqual(tree.lobeExposure, replay.lobeExposure);
  assert.deepEqual(tree.crownCenter, replay.crownCenter);
});
