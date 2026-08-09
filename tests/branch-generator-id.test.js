import assert from 'node:assert/strict';
import test from 'node:test';
import { BranchGenerator } from '../src/generation/branch-generator.js';
import { SeededRandom } from '../src/generation/seeded-random.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('branch generation resolves exposed targets by lobe id', () => {
  const preset = createTestPreset();
  const source = new TreeGenerator().generate(preset, 71, {
    includeLodCostSummaries: false,
  });
  const lobes = source.lobes.map((lobe, index) => ({
    ...lobe,
    id: index + 100,
    branchId: null,
  }));
  const runtimePreset = structuredClone(preset);
  runtimePreset.trunk.branching.exposedTipRatio = 1;

  const result = new BranchGenerator().generate(
    runtimePreset,
    lobes,
    new SeededRandom(991),
  );
  const lobeIds = new Set(lobes.map((lobe) => lobe.id));

  assert.ok(result.branches.some((branch) => branch.exposed));
  assert.ok(result.branches.every((branch) => lobeIds.has(branch.targetLobeId)));
  assert.ok(result.lobes.every((lobe) => Number.isInteger(lobe.branchId)));
});
