import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseTreeGenerationRuntimePolicy,
  resolveTreeGenerationWorkerCount,
} from '../src/workers/tree-generation-runtime-policy.js';

const CONFIG = Object.freeze({
  workers: Object.freeze({
    enabled: true,
    maximumWorkers: 2,
    reserveLogicalCores: 1,
    terminateOnCancel: true,
    maximumCachedResults: 4,
  }),
});

test('tree generation worker policy preserves a logical core for the browser', () => {
  const policy = parseTreeGenerationRuntimePolicy(CONFIG);

  assert.equal(resolveTreeGenerationWorkerCount(policy, 8), 2);
  assert.equal(resolveTreeGenerationWorkerCount(policy, 2), 1);
  assert.equal(resolveTreeGenerationWorkerCount(policy, 1), 1);
  assert.equal(resolveTreeGenerationWorkerCount(policy, undefined), 1);
  assert.equal(policy.maximumCachedResults, 4);
});

test('disabled tree generation workers resolve to zero workers', () => {
  const policy = parseTreeGenerationRuntimePolicy({
    workers: { ...CONFIG.workers, enabled: false },
  });

  assert.equal(resolveTreeGenerationWorkerCount(policy, 8), 0);
});

test('tree generation worker policy rejects invalid limits', () => {
  assert.throws(
    () =>
      parseTreeGenerationRuntimePolicy({
        workers: { ...CONFIG.workers, maximumWorkers: 0 },
      }),
    /positive integer/,
  );
  assert.throws(
    () =>
      parseTreeGenerationRuntimePolicy({
        workers: { ...CONFIG.workers, reserveLogicalCores: -1 },
      }),
    /non-negative integer/,
  );
  assert.throws(
    () =>
      parseTreeGenerationRuntimePolicy({
        workers: { ...CONFIG.workers, terminateOnCancel: 'yes' },
      }),
    /boolean/,
  );
  assert.throws(
    () =>
      parseTreeGenerationRuntimePolicy({
        workers: { ...CONFIG.workers, maximumCachedResults: 0 },
      }),
    /positive integer/,
  );
});
