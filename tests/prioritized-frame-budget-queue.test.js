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
