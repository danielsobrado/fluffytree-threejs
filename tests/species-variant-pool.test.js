import assert from 'node:assert/strict';
import test from 'node:test';
import { ForestInstanceBatchPlanner } from '../src/forest/forest-instance-batch-planner.js';
import { parseForestVariantPolicy } from '../src/forest/forest-variant-policy.js';
import { SpeciesVariantPool } from '../src/forest/species-variant-pool.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const policy = parseForestVariantPolicy(
  readYamlConfigSync(new URL('../config/forest-variant-policy.yaml', import.meta.url)),
);

function createPool(variantCount = 8, baseSeed = 7919) {
  return new SpeciesVariantPool({
    preset: { id: 'oak' },
    compilationService: {
      getTreeIr: (_preset, seed) => Object.freeze({ seed }),
      acquireRepresentation: (treeIr, role) =>
        Object.freeze({ value: Object.freeze({ treeIr, role }), release() {} }),
    },
    policy,
    variantCount,
    baseSeed,
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

test('forest batch planner separates the same variant index when geometry seeds differ', () => {
  const first = createPool(4, 101).resolveInstance('same-tree');
  const second = createPool(4, 202).resolveInstance('same-tree');

  assert.equal(first.variantIndex, second.variantIndex);
  assert.notEqual(first.seed, second.seed);

  const result = new ForestInstanceBatchPlanner().plan([
    { assignment: first, role: 'aggregate' },
    { assignment: second, role: 'aggregate' },
  ]);

  assert.equal(result.metrics.batchCount, 2);
  assert.equal(result.metrics.instancedBatchCount, 2);
  assert.deepEqual(
    result.batches.map((batch) => batch.seed).sort((left, right) => left - right),
    [first.seed, second.seed].sort((left, right) => left - right),
  );
});

test('forest batch planner keeps unique heroes with different seeds isolated', () => {
  const first = createPool(4, 303).resolveInstance('same-hero', { hero: true });
  const second = createPool(4, 404).resolveInstance('same-hero', { hero: true });

  assert.notEqual(first.seed, second.seed);

  const result = new ForestInstanceBatchPlanner().plan([
    { assignment: first, role: 'hero' },
    { assignment: second, role: 'hero' },
  ]);

  assert.equal(result.metrics.batchCount, 2);
  assert.equal(result.metrics.uniqueBatchCount, 2);
});

test('forest batch planner keys cannot collide through identifier separators', () => {
  const result = new ForestInstanceBatchPlanner().plan([
    {
      assignment: {
        presetId: 'oak:hero',
        instanceId: 'tree',
        shared: false,
        variantIndex: null,
        seed: 17,
      },
      role: 'hero',
    },
    {
      assignment: {
        presetId: 'oak',
        instanceId: 'hero:tree',
        shared: false,
        variantIndex: null,
        seed: 17,
      },
      role: 'hero',
    },
  ]);

  assert.equal(result.metrics.batchCount, 2);
});

test('forest batch planner rejects malformed assignment identity', () => {
  const planner = new ForestInstanceBatchPlanner();

  assert.throws(
    () =>
      planner.plan([
        {
          assignment: {
            presetId: 'oak',
            instanceId: 'tree',
            shared: true,
            variantIndex: null,
            seed: 1,
          },
          role: 'aggregate',
        },
      ]),
    /variant index/,
  );
  assert.throws(
    () =>
      planner.plan([
        {
          assignment: {
            presetId: 'oak',
            instanceId: 'tree',
            shared: false,
            variantIndex: null,
            seed: Number.NaN,
          },
          role: 'hero',
        },
      ]),
    /unsigned 32-bit integer/,
  );
});
