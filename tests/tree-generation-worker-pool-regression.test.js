import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerationWorkerPool } from '../src/workers/tree-generation-worker-pool.js';

const POLICY = Object.freeze({ maximumWorkers: 1, terminateOnCancel: true });
const PRESET = Object.freeze({ id: 'test-tree' });

class FakeWorker {
  constructor({ postError = null } = {}) {
    this.listeners = new Map();
    this.postError = postError;
    this.terminated = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  postMessage() {
    if (this.postError) throw this.postError;
  }

  terminate() {
    this.terminated = true;
  }
}

function createPool(options = {}) {
  const workers = [];
  const pool = new TreeGenerationWorkerPool({
    policy: options.policy ?? POLICY,
    workerFactory: () => {
      const worker = new FakeWorker(options.workerOptions?.(workers.length));
      workers.push(worker);
      return worker;
    },
  });
  return { pool, workers };
}

test('worker pool rejects configurations that cannot dispatch work', () => {
  for (const maximumWorkers of [0, -1]) {
    assert.throws(
      () =>
        new TreeGenerationWorkerPool({
          policy: { maximumWorkers, terminateOnCancel: true },
          workerFactory: () => new FakeWorker(),
        }),
      /maximumWorkers.*positive integer/,
    );
  }

  assert.throws(
    () =>
      new TreeGenerationWorkerPool({
        policy: { maximumWorkers: 1, terminateOnCancel: 'yes' },
        workerFactory: () => new FakeWorker(),
      }),
    /terminateOnCancel.*boolean/,
  );
});

test('invalid priority does not supersede valid in-flight work', async () => {
  const { pool } = createPool();
  const active = pool.submit({ key: 'same', priority: 1, preset: PRESET, seed: 1 });

  await assert.rejects(
    pool.submit({ key: 'same', priority: Number.NaN, preset: PRESET, seed: 2 }),
    /priority.*finite/,
  );
  assert.equal(pool.metrics.activeJobCount, 1);
  assert.equal(pool.metrics.busyWorkerCount, 1);
  assert.equal(pool.metrics.cancelledCount, 0);

  const shutdown = assert.rejects(active, /shutdown/);
  pool.destroy();
  await shutdown;
});

test('synchronous worker dispatch failures reject without wedging the slot', async () => {
  const dispatchError = new Error('post failed');
  const { pool, workers } = createPool({
    workerOptions: (index) => (index === 0 ? { postError: dispatchError } : {}),
  });

  await assert.rejects(
    pool.submit({ key: 'broken', priority: 1, preset: PRESET, seed: 3 }),
    /post failed/,
  );

  assert.equal(pool.metrics.activeJobCount, 0);
  assert.equal(pool.metrics.busyWorkerCount, 0);
  assert.equal(pool.metrics.failedCount, 1);
  assert.equal(workers[0].terminated, true);
  assert.equal(workers.length, 2);
  pool.destroy();
});

test('invalid worker instances are terminated during construction failure', () => {
  let terminated = false;
  const worker = {
    postMessage() {},
    terminate() {
      terminated = true;
    },
  };

  assert.throws(
    () =>
      new TreeGenerationWorkerPool({
        policy: POLICY,
        workerFactory: () => worker,
      }),
    /addEventListener/,
  );
  assert.equal(terminated, true);
});
