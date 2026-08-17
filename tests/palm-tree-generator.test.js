import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeAnimationLodPlanner } from '../src/animation/tree-animation-lod-planner.js';
import { parseTreeAnimationPolicy } from '../src/animation/tree-animation-policy-config.js';
import { FoliagePrimitiveCompiler } from '../src/compilation/foliage-primitive-compiler.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { expandTreeIrFrondBounds } from '../src/generation/tree-ir-frond-bounds.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const palmConfig = readYamlConfigSync(
  new URL('../config/palm-presets.yaml', import.meta.url),
);
const animationPolicy = parseTreeAnimationPolicy(
  readYamlConfigSync(new URL('../config/tree-animation-policy.yaml', import.meta.url)),
);

function coconutPalm() {
  return PresetLibrary.fromConfig(palmConfig).get('coconutPalm');
}

function emptyBounds() {
  return {
    minimum: {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      z: Number.POSITIVE_INFINITY,
    },
    maximum: {
      x: Number.NEGATIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
      z: Number.NEGATIVE_INFINITY,
    },
  };
}

test('palm presets use a model-specific schema without broadleaf crown fields', () => {
  const library = PresetLibrary.fromConfig(palmConfig);
  const preset = library.get('coconutPalm');

  assert.deepEqual(library.ids, ['coconutPalm', 'datePalm']);
  assert.equal(preset.generationModel, 'palm');
  assert.equal(Object.hasOwn(preset, 'crown'), false);
  assert.equal(Object.hasOwn(preset.foliage, 'shell'), false);
  assert.equal(preset.morphology.frondCount, 18);
});

test('palm generation emits deterministic trunk and frond Tree IR without lobe topology', () => {
  const generator = new TreeGenerator();
  const preset = coconutPalm();
  const first = generator.generateIr(preset, 71237);
  const second = generator.generateIr(preset, 71237);

  assert.deepEqual(first, second);
  assert.equal(first.generationModel, 'palm');
  assert.equal(first.stems.length, 1);
  assert.equal(first.foliageSites.length, preset.morphology.frondCount);
  assert.equal(first.windNodes.length, preset.morphology.frondCount + 1);
  assert.ok(first.foliageSites.every((site) => site.primitiveFamily === 'frond'));
  assert.ok(first.foliageSites.every((site) => typeof site.windNodeId === 'string'));
  assert.equal(first.metadata.legacyRendererCompatible, false);
});

test('palm Tree IR bounds contain every generated frond envelope', () => {
  const ir = new TreeGenerator().generateIr(coconutPalm(), 71237);

  for (const site of ir.foliageSites) {
    const frondBounds = expandTreeIrFrondBounds(emptyBounds(), site);
    for (const axis of ['x', 'y', 'z']) {
      assert.ok(ir.bounds.minimum[axis] <= frondBounds.minimum[axis]);
      assert.ok(ir.bounds.maximum[axis] >= frondBounds.maximum[axis]);
    }
  }
});

test('palm foliage compiles through frond-specific role backends', () => {
  const ir = new TreeGenerator().generateIr(coconutPalm(), 31);
  const compiler = new FoliagePrimitiveCompiler();

  assert.equal(compiler.compile(ir, 'hero')[0].kind, 'frond-geometry');
  assert.equal(compiler.compile(ir, 'near')[0].kind, 'frond-card');
  assert.equal(compiler.compile(ir, 'aggregate')[0].kind, 'frond-proxy');
});

test('palm hero animation retains frond wind nodes while aggregate collapses them', () => {
  const ir = new TreeGenerator().generateIr(coconutPalm(), 61);
  const planner = new TreeAnimationLodPlanner();
  const hero = planner.compile(ir, 'hero', animationPolicy);
  const aggregate = planner.compile(ir, 'aggregate', animationPolicy);

  assert.equal(hero.activeWindNodeCount, ir.windNodes.length);
  assert.equal(aggregate.activeWindNodeCount, 1);
});

test('legacy mesh generation fails explicitly instead of disguising palms as lobe trees', () => {
  assert.throws(
    () => new TreeGenerator().generate(coconutPalm(), 91),
    /no legacy renderer metadata/,
  );
});
