import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameBudgetQueue } from '../src/generation/frame-budget-queue.js';

test('generation queue is deterministic, keyed, and respects its frame budget', () => {
  let time = 0;
  const queue = new FrameBudgetQueue({ now: () => time });
  const completed = [];
  queue.enqueue('a', () => {
    completed.push('a');
    time += 5;
  });
  queue.enqueue('b', () => {
    completed.push('b');
    time += 5;
  });
  assert.equal(queue.enqueue('b', () => completed.push('duplicate')), false);

  assert.equal(queue.process(8), 2);
  assert.deepEqual(completed, ['a', 'b']);
  assert.equal(queue.length, 0);
});

test('generation queue leaves later tasks for the next frame', () => {
  let time = 0;
  const queue = new FrameBudgetQueue({ now: () => time });
  const completed = [];
  for (const key of ['a', 'b', 'c']) {
    queue.enqueue(key, () => {
      completed.push(key);
      time += 6;
    });
  }

  assert.equal(queue.process(8), 2);
  assert.equal(queue.length, 1);
  assert.equal(queue.process(8), 1);
  assert.deepEqual(completed, ['a', 'b', 'c']);
});
