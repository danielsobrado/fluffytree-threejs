import assert from 'node:assert/strict';
import test from 'node:test';
import { ForestInstanceBatchPlanner } from '../src/forest/forest-instance-batch-planner.js';
import { parseForestVariantPolicy } from '../src/forest/forest-variant-policy.js';
import { SpeciesVariantPool } from '../src/forest/species-variant-pool.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const policy = parseForestVariantPolicy(
  readYamlConfigSync(new URL('../config/forest-variant-policy.yaml', import.meta.url)),
);

function createPool(variantCount = 8) {
  return new SpeciesVariantPool({
    preset: { id: 'oak' },
    compilationService: {
      getTreeIr: (_preset, seed) => Object.freeze({ seed }),
      acquireRepresentation: (treeIr, role) =>
        Object.freeze({ value: Object.freeze({ treeIr, role }), release() {} }),
    },
    policy,
    variantCount,
    baseSeed: 7919,
  });
}

test('species variant pool maps world instances to a bounded deterministic set', () => {
  const first = createPool(8);
  const second = createPool(8);
  const indexes = new Set();

  for (let index = 0; index < 512; index += 1) {
    const left = first.resolveInstance(`tree-${index}`);
    const right = second.resolveInstance(`tree-${index}`);
    assert.deepEqual(left, right);
    indexes.add(left.variantIndex);
  }

  assert.equal(indexes.size, 8);
  assert.equal(first.metrics.generatedVariantCount, 8);
  assert.equal(first.metrics.sharedRequests, 512);
});

test('species variant pool gives hero instances unique deterministic seeds', () => {
  const pool = createPool(4);
  const shared = pool.resolveInstance('hero-candidate');
  const hero = pool.resolveInstance('hero-candidate', { hero: true });
  const heroAgain = createPool(4).resolveInstance('hero-candidate', { hero: true });

  assert.equal(shared.shared, true);
  assert.equal(hero.shared, false);
  assert.equal(hero.variantIndex, null);
  assert.deepEqual(hero, heroAgain);
  assert.notEqual(hero.seed, shared.seed);
});

test('per-instance scale, color and wind variation is stable and policy bounded', () => {
  const pool = createPool();
  const variation = pool.variationForInstance('stable-tree');

  assert.ok(variation.scale >= policy.scaleRange[0]);
  assert.ok(variation.scale <= policy.scaleRange[1]);
  assert.ok(variation.colorOffset >= policy.colorOffsetRange[0]);
  assert.ok(variation.colorOffset <= policy.colorOffsetRange[1]);
  assert.ok(variation.windStrength >= policy.windStrengthRange[0]);
  assert.ok(variation.windStrength <= policy.windStrengthRange[1]);
  assert.ok(variation.windPhase >= 0 && variation.windPhase < Math.PI * 2);
  assert.deepEqual(variation, pool.variationForInstance('stable-tree'));
});

test('forest batch planner groups shared variants and isolates unique heroes', () => {
  const pool = createPool(4);
  const sharedA = pool.resolveInstance('a');
  const sharedB = Object.freeze({
    ...pool.resolveInstance('b'),
    variantIndex: sharedA.variantIndex,
    seed: sharedA.seed,
  });
  const hero = pool.resolveInstance('hero', { hero: true });
  const result = new ForestInstanceBatchPlanner().plan([
    { assignment: sharedA, role: 'aggregate' },
    { assignment: sharedB, role: 'aggregate' },
    { assignment: hero, role: 'hero' },
  ]);

  assert.equal(result.metrics.instanceCount, 3);
  assert.equal(result.metrics.batchCount, 2);
  assert.equal(result.metrics.instancedBatchCount, 1);
  assert.equal(result.metrics.uniqueBatchCount, 1);
  assert.equal(
    result.batches.find((batch) => batch.instancingEligible).instanceIds.length,
    2,
  );
});
