import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPointDistance } from '../src/generation/lobe-geometry.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('every generated branch terminates inside its target foliage lobe', () => {
  const preset = createTestPreset();
  const generator = new TreeGenerator();

  for (let seed = 1; seed <= 64; seed += 1) {
    const tree = generator.generate(preset, seed);

    for (const branch of tree.branches) {
      const target = tree.lobes.find(
        (lobe) => lobe.id === branch.targetLobeId,
      );
      assert.ok(target);
      const insertion = normalizedPointDistance(branch.points.at(-1), target);
      assert.ok(insertion >= 0.54 && insertion < 1.19);
      if (!branch.exposed) assert.ok(Math.abs(insertion - 0.55) < 1e-9);
    }
  }
});

test('generated branches form a tapered parented graph anchored to foliage', () => {
  const tree = new TreeGenerator().generate(createTestPreset(), 991);
  const branches = new Map(tree.branches.map((branch) => [branch.id, branch]));

  assert.equal(
    tree.branches.filter((branch) => branch.parentId === null).length,
    4,
  );
  for (const branch of tree.branches) {
    if (branch.parentId === null) continue;
    const parent = branches.get(branch.parentId);
    assert.ok(parent);
    assert.ok(parent.order < branch.order);
    assert.ok(parent.startRadius > branch.startRadius);
  }
  assert.ok(tree.lobes.every((lobe) => branches.has(lobe.branchId)));
});
