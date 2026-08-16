import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { TREE_IR_SCHEMA_VERSION } from '../src/generation/tree-ir-schema.js';
import { validateTreeIr } from '../src/generation/tree-ir-validator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const preset = createTestPreset();

test('crown-lobe generation emits deterministic serializable Tree IR', () => {
  const generator = new TreeGenerator();
  const first = generator.generateIr(preset, 12345);
  const second = generator.generateIr(preset, 12345);

  assert.equal(first.schemaVersion, TREE_IR_SCHEMA_VERSION);
  assert.equal(first.generationModel, 'crown-lobe');
  assert.deepEqual(first, second);
  assert.deepEqual(JSON.parse(JSON.stringify(first)), first);
  assert.doesNotThrow(() => validateTreeIr(first));
});

test('Tree IR contains a valid stem graph and renderer-independent foliage sites', () => {
  const ir = new TreeGenerator().generateIr(preset, 44);
  const stemIds = new Set(ir.stems.map((stem) => stem.id));

  assert.ok(stemIds.has(ir.root.stemId));
  assert.ok(ir.stems.length > 1);
  assert.ok(
    ir.stems.every(
      (stem) => stem.parentId === null || stemIds.has(stem.parentId),
    ),
  );
  assert.ok(ir.crownVolumes.length > 0);
  assert.ok(ir.foliageSites.length > 0);
  assert.ok(
    ir.foliageSites.every((site) => stemIds.has(site.parentStemId)),
  );
  assert.ok(
    ir.foliageSites.every((site) => site.primitiveFamily === 'broadleaf'),
  );
});

test('legacy tree output remains compatible while generation goes through Tree IR', () => {
  const generator = new TreeGenerator();
  const tree = generator.generate(preset, 44);
  const ir = generator.generateIr(preset, 44);

  assert.equal(tree.presetId, ir.presetId);
  assert.equal(tree.generationModel, ir.generationModel);
  assert.equal(tree.branches.length, ir.stems.length - 1);
  assert.equal(tree.lobes.length, ir.crownVolumes.length);
  assert.equal(tree.shell.length, ir.foliageSites.length);
  assert.equal(tree.branchGraph.branches, tree.branches);
  assert.equal(tree.sprayRecords, tree.shell);
});

test('Tree IR validation rejects broken parent references', () => {
  const ir = structuredClone(
    new TreeGenerator().generateIr(preset, 44, { includeSurfaceSamples: false }),
  );
  ir.stems[1].parentId = 'stem:missing';

  assert.throws(() => validateTreeIr(ir), /unknown parent/);
});
