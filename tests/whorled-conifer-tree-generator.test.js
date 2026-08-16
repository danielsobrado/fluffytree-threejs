import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { parseWhorledConiferConfig } from '../src/generation/whorled-conifer-config.js';
import { WHORLED_CONIFER_MODEL_ID } from '../src/generation/whorled-conifer-constants.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const MORPHOLOGY = Object.freeze({
  whorlCount: 4,
  branchesPerWhorl: Object.freeze([3, 3]),
  crownTaperPower: 1.2,
  branchSag: 0.18,
  branchLengthVariation: 0.08,
  whorlTwist: 0.4,
  lowerBranchMortality: 0.12,
  leaderWander: 0.04,
  foliageScale: 0.75,
});

function createConiferPreset() {
  const base = createTestPreset({
    crown: { profile: 'columnar' },
    foliage: {
      leafShape: 'needle',
      shell: { candidatesPerLobe: 64, planesPerCluster: 2 },
    },
  });
  return Object.freeze({
    ...base,
    generationModel: WHORLED_CONIFER_MODEL_ID,
    morphology: MORPHOLOGY,
  });
}

function branchLength(stem) {
  const start = stem.path[0];
  const end = stem.path.at(-1);
  return Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test('configured conifer presets validate with model-specific morphology', () => {
  const config = readYamlConfigSync(
    new URL('../config/conifer-presets.yaml', import.meta.url),
  );
  const library = PresetLibrary.fromConfig(config);

  assert.deepEqual(library.ids, ['norwaySpruce', 'scotsPine']);
  for (const preset of library.presets.values()) {
    assert.equal(preset.generationModel, WHORLED_CONIFER_MODEL_ID);
    assert.equal(preset.foliage.leafShape, 'needle');
    assert.doesNotThrow(() => parseWhorledConiferConfig(preset));
  }
});

test('whorled conifer generation is deterministic and uses needle foliage sites', () => {
  const preset = createConiferPreset();
  const generator = new TreeGenerator();
  const first = generator.generateIr(preset, 99173);
  const second = generator.generateIr(preset, 99173);

  assert.deepEqual(first, second);
  assert.equal(first.generationModel, WHORLED_CONIFER_MODEL_ID);
  assert.ok(first.stems.length > MORPHOLOGY.whorlCount);
  assert.ok(first.foliageSites.length > 0);
  assert.ok(
    first.foliageSites.every(
      (site) => site.primitiveFamily === 'needle-cluster',
    ),
  );
});

test('whorled conifer preserves a dominant leader and tapered branch whorls', () => {
  const ir = new TreeGenerator().generateIr(createConiferPreset(), 1777, {
    includeSurfaceSamples: false,
  });
  const branches = ir.stems.filter((stem) => stem.order === 1);
  const lower = branches
    .filter((stem) => stem.metadata.legacy.macroClumpId === 0)
    .map(branchLength);
  const upper = branches
    .filter(
      (stem) => stem.metadata.legacy.macroClumpId === MORPHOLOGY.whorlCount - 1,
    )
    .map(branchLength);

  assert.equal(ir.stems[0].order, 0);
  assert.ok(ir.stems[0].path.at(-1).y > ir.height * 0.99);
  assert.ok(lower.length > 0 && upper.length > 0);
  assert.ok(average(lower) > average(upper));
});

test('legacy renderer data remains available for whorled conifers', () => {
  const tree = new TreeGenerator().generate(createConiferPreset(), 81, {
    includeSurfaceSamples: false,
  });

  assert.equal(tree.generationModel, WHORLED_CONIFER_MODEL_ID);
  assert.ok(tree.branches.length > 0);
  assert.ok(tree.lobes.length > tree.clumps.length);
  assert.equal(tree.shell.length, 0);
});
