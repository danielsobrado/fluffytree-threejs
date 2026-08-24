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
