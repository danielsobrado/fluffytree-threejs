import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { FoliagePrimitiveCompiler } from '../src/compilation/foliage-primitive-compiler.js';
import { TreeRepresentationCompiler } from '../src/compilation/tree-representation-compiler.js';
import { parseTreeQualityProfiles } from '../src/compilation/tree-quality-profile-config.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const qualityProfiles = parseTreeQualityProfiles(
  readYamlConfigSync(new URL('../config/tree-quality-profiles.yaml', import.meta.url)),
);
const qualityProfile = qualityProfiles.default;

function createIr() {
  return new TreeGenerator().generateIr(createTestPreset(), 71);
}

test('foliage compiler keeps logical sites separate from rendered representations', () => {
  const ir = createIr();
  const compiler = new FoliagePrimitiveCompiler();
  const hero = compiler.compile(ir, 'hero');
  const aggregate = compiler.compile(ir, 'aggregate');

  assert.equal(hero.length, 1);
  assert.equal(hero[0].family, 'broadleaf');
  assert.equal(hero[0].kind, 'hybrid-leaf-card');
  assert.equal(hero[0].coveragePolicy, 'certified');
  assert.equal(hero[0].sourceSiteCount, ir.foliageSites.length);
  assert.equal(aggregate[0].kind, 'crown-volume');
  assert.deepEqual(ir.foliageSites[0].metadata.render.position, ir.foliageSites[0].frame.position);
});

test('needle foliage resolves through a dedicated backend', () => {
  const ir = structuredClone(createIr());
  for (const site of ir.foliageSites) site.primitiveFamily = 'needle-cluster';
  const plans = new FoliagePrimitiveCompiler().compile(ir, 'near');

  assert.equal(plans.length, 1);
  assert.equal(plans[0].backendId, 'needle');
  assert.equal(plans[0].kind, 'needle-cluster');
  assert.equal(plans[0].coveragePolicy, 'family-density');
});

test('frond interface is ready without coupling Tree IR to a card backend', () => {
  const ir = structuredClone(createIr());
  for (const site of ir.foliageSites) site.primitiveFamily = 'frond';
  const compiler = new FoliagePrimitiveCompiler();

  assert.equal(compiler.compile(ir, 'hero')[0].kind, 'frond-geometry');
  assert.equal(compiler.compile(ir, 'near')[0].kind, 'frond-card');
  assert.equal(compiler.compile(ir, 'aggregate')[0].kind, 'frond-proxy');
});

test('representation compiler produces role-specific immutable plans and metrics', () => {
  const ir = createIr();
  const compiler = new TreeRepresentationCompiler();
  const hero = compiler.compile(ir, 'hero', qualityProfile);
  const near = compiler.compile(ir, 'near', qualityProfile);
  const aggregate = compiler.compile(ir, 'aggregate', qualityProfile);

  assert.equal(hero.structure.compiledStemCount, ir.stems.length);
  assert.ok(near.structure.compiledStemCount <= hero.structure.compiledStemCount);
  assert.ok(
    aggregate.structure.compiledStemCount <= near.structure.compiledStemCount,
  );
  assert.equal(hero.foliage[0].requestedDensity, 1);
  assert.equal(near.foliage[0].requestedDensity, 0.58);
  assert.equal(aggregate.foliage[0].requestedDensity, 0);
  assert.equal(Object.isFrozen(hero), true);
  assert.equal(typeof hero.cacheKey, 'string');
  assert.ok(hero.cacheKey.length > 20);
});
