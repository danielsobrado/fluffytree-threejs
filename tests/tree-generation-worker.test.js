import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { validateTreeIr } from '../src/generation/tree-ir-validator.js';
import { WorkerTreeGenerationService } from '../src/workers/worker-tree-generation-service.js';
import {
  createTreeGenerationRequest,
  TREE_GENERATION_WORKER_MESSAGES,
} from '../src/workers/tree-generation-worker-protocol.js';
import { installTreeGenerationWorker } from '../src/workers/tree-generation-worker-runtime.js';
import { TreeGenerationWorkerPool } from '../src/workers/tree-generation-worker-pool.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const preset = createTestPreset();

function validIr(seed = 41) {
  return new TreeGenerator().generateIr(preset, seed, {
    includeSurfaceSamples: false,
  });
}

class FakeWorker {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
    this.terminated = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage(message) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(type, event) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }

  latestGenerateMessage() {
    return [...this.messages]
      .reverse()
      .find((message) => message.type === TREE_GENERATION_WORKER_MESSAGES.GENERATE);
  }

  respond(treeIr) {
    const message = this.latestGenerateMessage();
    this.emit('message', {
      data: {
        type: TREE_GENERATION_WORKER_MESSAGES.RESULT,
        requestId: message.request.requestId,
        key: message.request.key,
        revision: message.request.revision,
        treeIr,
      },
    });
  }
}

function createPool(policy = { maximumWorkers: 1, terminateOnCancel: true }) {
  const workers = [];
  const pool = new TreeGenerationWorkerPool({
    policy,
    workerFactory: () => {
      const worker = new FakeWorker();
      workers.push(worker);
      return worker;
    },
  });
  return { pool, workers };
}

test('worker runtime produces validated Tree IR messages', () => {
  let handler = null;
  const messages = [];
  const scope = {
    addEventListener(type, listener) {
      if (type === 'message') handler = listener;
    },
    postMessage(message) {
      messages.push(message);
    },
  };
  installTreeGenerationWorker(scope, { treeGenerator: new TreeGenerator() });
  const request = createTreeGenerationRequest({
    requestId: 'request:1',
    key: 'test',
    revision: 1,
    preset,
    seed: 71,
    options: { includeSurfaceSamples: false },
  });

  handler({
    data: { type: TREE_GENERATION_WORKER_MESSAGES.GENERATE, request },
  });

  assert.equal(messages.length, 1);
  assert.equal(messages[0].type, TREE_GENERATION_WORKER_MESSAGES.RESULT);
  assert.doesNotThrow(() => validateTreeIr(messages[0].treeIr));
});

test('worker protocol rejects values that cannot cross a worker boundary safely', () => {
  assert.throws(
    () =>
      createTreeGenerationRequest({
        requestId: 'unsafe:1',
        key: 'unsafe',
        revision: 1,
        preset,
        seed: 1,
        options: { callback() {} },
      }),
    /canonical serializable data/,
  );
});

test('worker pool prioritizes queued generation after the active worker frees', async () => {
  const { pool, workers } = createPool();
  const blocker = pool.submit({ key: 'blocker', priority: 1, preset, seed: 1 });
  const low = pool.submit({ key: 'low', priority: 2, preset, seed: 2 });
  const high = pool.submit({ key: 'high', priority: 9, preset, seed: 3 });
  const worker = workers[0];

  assert.equal(worker.latestGenerateMessage().request.key, 'blocker');
  worker.respond(validIr(1));
  await blocker;
  assert.equal(worker.latestGenerateMessage().request.key, 'high');
  worker.respond(validIr(3));
  await high;
  assert.equal(worker.latestGenerateMessage().request.key, 'low');
  worker.respond(validIr(2));
  await low;

  assert.equal(pool.metrics.completedCount, 3);
  pool.destroy();
});

test('superseding an in-flight job cancels it and replaces the worker', async () => {
  const { pool, workers } = createPool();
  const first = pool.submit({ key: 'same', priority: 1, preset, seed: 11 });
  const firstWorker = workers[0];
  const rejected = assert.rejects(first, /superseded/);
  const second = pool.submit({ key: 'same', priority: 8, preset, seed: 12 });

  await rejected;
  assert.equal(firstWorker.terminated, true);
  assert.equal(workers.length, 2);
  assert.equal(workers[1].latestGenerateMessage().request.seed, 12);
  workers[1].respond(validIr(12));
  await second;
  assert.equal(pool.metrics.cancelledCount, 1);
  pool.destroy();
});

test('events from a terminated worker cannot affect its replacement slot', async () => {
  const { pool, workers } = createPool();
  const first = pool.submit({ key: 'same', priority: 1, preset, seed: 31 });
  const firstWorker = workers[0];
  const rejected = assert.rejects(first, /superseded/);
  const second = pool.submit({ key: 'same', priority: 8, preset, seed: 32 });
  await rejected;

  firstWorker.emit('error', { message: 'stale worker event' });
  firstWorker.respond(validIr(31));
  assert.equal(pool.metrics.failedCount, 0);
  assert.equal(pool.metrics.activeJobCount, 1);

  workers[1].respond(validIr(32));
  assert.equal((await second).seed, 32);
  pool.destroy();
});

test('worker generation service shares in-flight work and caches completed IR', async () => {
  let submitCount = 0;
  const ir = validIr(81);
  const workerPool = {
    metrics: Object.freeze({ workerCount: 1 }),
    submit() {
      submitCount += 1;
      return Promise.resolve(ir);
    },
    cancel() {
      return false;
    },
    destroy() {},
  };
  const service = new WorkerTreeGenerationService({
    workerPool,
    maximumCacheEntries: 4,
  });

  const first = service.generate(preset, 81, {
    generationOptions: { includeSurfaceSamples: false },
  });
  const second = service.generate(preset, 81, {
    generationOptions: { includeSurfaceSamples: false },
  });
  assert.equal(first, second);
  assert.equal(await first, ir);
  assert.equal(
    await service.generate(preset, 81, {
      generationOptions: { includeSurfaceSamples: false },
    }),
    ir,
  );
  assert.equal(submitCount, 1);
  assert.equal(service.metrics.cache.hits, 1);
  service.destroy();
});
