import assert from 'node:assert/strict';
import test from 'node:test';
import { WorkerTreeGenerationService } from '../src/workers/worker-tree-generation-service.js';

const PRESET = Object.freeze({ id: 'cache-test', generationModel: 'crown-lobe' });

test('worker generation cache records one miss for one generated tree', async () => {
  let submits = 0;
  const treeIr = Object.freeze({ id: 'generated' });
  const workerPool = {
    metrics: Object.freeze({ workerCount: 1 }),
    submit() {
      submits += 1;
      return Promise.resolve(treeIr);
    },
    destroy() {},
  };
  const service = new WorkerTreeGenerationService({
    workerPool,
    maximumCacheEntries: 2,
  });

  assert.equal(await service.generate(PRESET, 17), treeIr);
  assert.equal(await service.generate(PRESET, 17), treeIr);
  assert.equal(submits, 1);
  assert.equal(service.metrics.cache.misses, 1);
  assert.equal(service.metrics.cache.hits, 1);
  service.destroy();
});

test('worker generation service does not repopulate caches after shutdown', async () => {
  let resolveGeneration;
  let destroys = 0;
  const pending = new Promise((resolve) => {
    resolveGeneration = resolve;
  });
  const workerPool = {
    metrics: Object.freeze({ workerCount: 1 }),
    submit() {
      return pending;
    },
    destroy() {
      destroys += 1;
    },
  };
  const service = new WorkerTreeGenerationService({
    workerPool,
    maximumCacheEntries: 2,
  });
  const generation = service.generate(PRESET, 19);

  service.destroy();
  resolveGeneration(Object.freeze({ id: 'late-result' }));

  await assert.rejects(generation, /destroyed before completion/);
  await assert.rejects(service.generate(PRESET, 19), /service is destroyed/);
  assert.equal(service.metrics.cache.entries, 0);
  assert.equal(service.metrics.cache.hits, 0);
  assert.equal(destroys, 1);

  service.destroy();
  assert.equal(destroys, 1);
});
