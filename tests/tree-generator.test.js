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
  assert.ok(tree.branches.length >= preset.crown.lobeCount);
  assert.equal(
    tree.branches.filter((branch) => branch.parentId === null).length,
    preset.trunk.branching.primaryCount,
  );
  assert.equal(tree.trunk.points.length, preset.trunk.segments + 1);
  assert.ok(tree.shell.length > 0);
  assert.ok(
    tree.shell.length <=
      preset.crown.lobeCount * preset.foliage.shell.candidatesPerLobe,
  );
  assert.equal(tree.lobeExposure.length, preset.crown.lobeCount);
  assert.ok(tree.lobes.every((lobe) => Number.isInteger(lobe.macroClumpId)));
  assert.ok(tree.lobes.every((lobe) => Number.isInteger(lobe.branchId)));
  assert.equal(tree.branchGraph.branches, tree.branches);
  assert.equal(tree.clumps.length, preset.crown.clumps.macroCount);
  assert.equal(tree.sprayRecords, tree.shell);
  assert.ok(tree.bounds.minimum.y <= 0);
  assert.equal(tree.lodCostSummaries.lodTriangles.length, 4);
});

test('runtime generation omits obsolete foliage surface samples', () => {
  const tree = new TreeGenerator().generate(preset, 44, {
    includeSurfaceSamples: false,
  });

  assert.equal(tree.shell.length, 0);
  assert.deepEqual(
    tree.lobeExposure,
    Array.from({ length: preset.crown.lobeCount }, () => 1),
  );
  assert.equal(tree.lobes.length, preset.crown.lobeCount);
  assert.ok(tree.branches.length >= preset.crown.lobeCount);
  assert.equal(tree.lodCostSummaries.heroLeafClusters, 0);
});

test('runtime generation can skip QA-only LOD cost analysis', () => {
  const tree = new TreeGenerator().generate(preset, 44, {
    includeLodCostSummaries: false,
  });

  assert.equal(Object.hasOwn(tree, 'lodCostSummaries'), false);
  assert.ok(tree.shell.length > 0);
});
