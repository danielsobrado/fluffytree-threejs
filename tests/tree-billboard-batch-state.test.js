import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeBillboardBatchState } from '../src/rendering/tree-billboard-batch-state.js';

test('billboard batch state migrates instances with bounded complementary fades', () => {
  const batch = new TreeBillboardBatchState(2);
  const first = batch.add('first');
  const second = batch.add('second');
  batch.setFade(first, -1);
  batch.setFade(second, 0.65, true);

  assert.deepEqual(batch.entries, ['first', 'second']);
  assert.equal(batch.fades[first], 0);
  assert.ok(Math.abs(batch.fades[second] - 0.65) < 0.000001);
  assert.equal(batch.inverted[second], 1);
  assert.equal(batch.activeCount, 1);

  batch.setFade(second, 0);
  assert.equal(batch.activeCount, 0);
  assert.throws(() => batch.add('overflow'), /exceeded/);
  assert.throws(() => batch.setFade(3, 1), /Unknown/);
});
