import assert from 'node:assert/strict';
import test from 'node:test';
import { PrioritizedFrameBudgetQueue } from '../src/generation/prioritized-frame-budget-queue.js';

test('prioritized queue bounds stale heap growth from repeated keyed replacements', () => {
  const queue = new PrioritizedFrameBudgetQueue({ now: () => 0 });
  let calls = 0;

  for (let index = 0; index < 1000; index += 1) {
    queue.enqueue('chunk', index, () => {
      calls += 1;
    });
  }

  assert.equal(queue.length, 1);
  assert.ok(queue.heap.length <= 32);
  assert.equal(queue.supersededCount, 999);
  assert.equal(queue.process(1), 1);
  assert.equal(calls, 1);
  assert.equal(queue.length, 0);
});

test('prioritized queue validates replacement priority before supersede accounting', () => {
  const queue = new PrioritizedFrameBudgetQueue({ now: () => 0 });
  const calls = [];
  queue.enqueue('chunk', 1, () => calls.push('valid'));

  assert.throws(
    () => queue.enqueue('chunk', Number.NaN, () => calls.push('invalid')),
    /priority must be finite/,
  );
  assert.equal(queue.supersededCount, 0);
  assert.equal(queue.length, 1);

  queue.process(1);
  assert.deepEqual(calls, ['valid']);
});

test('prioritized queue releases canceled entries when no work remains', () => {
  const queue = new PrioritizedFrameBudgetQueue({ now: () => 0 });
  queue.enqueue('chunk', 1, () => {});

  assert.equal(queue.cancel('chunk'), true);
  assert.equal(queue.length, 0);
  assert.equal(queue.heap.length, 0);
  assert.equal(queue.cancel('chunk'), false);
});

test('idle prioritized queue does not sample the frame clock', () => {
  let clockReads = 0;
  const queue = new PrioritizedFrameBudgetQueue({
    now: () => {
      clockReads += 1;
      return 0;
    },
  });

  assert.equal(queue.process(8), 0);
  assert.equal(queue.lastProcessDuration, 0);
  assert.equal(clockReads, 0);
});

test('prioritized queue validates its frame clock dependency', () => {
  assert.throws(
    () => new PrioritizedFrameBudgetQueue({ now: null }),
    /now must be a function/,
  );
});
