import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseTreeBillboardBatchReferences } from '../src/rendering/tree-billboard-batch-lifecycle.js';

function tree() {
  return { userData: { lod: {} } };
}

test('batch disposal releases matching tree handles and entry references', () => {
  const first = tree();
  const second = tree();
  const batch = { state: { entries: [first, second], activeCount: 2 } };
  first.userData.lod.billboardBatch = { batch, index: 0 };
  second.userData.lod.billboardBatch = { batch, index: 1 };

  assert.equal(releaseTreeBillboardBatchReferences(batch), 2);
  assert.equal(first.userData.lod.billboardBatch, null);
  assert.equal(second.userData.lod.billboardBatch, null);
  assert.deepEqual(batch.state.entries, []);
  assert.equal(batch.state.activeCount, 0);
});

test('batch disposal does not clear handles belonging to another batch', () => {
  const item = tree();
  const otherBatch = {};
  const batch = { state: { entries: [item], activeCount: 0 } };
  item.userData.lod.billboardBatch = { batch: otherBatch, index: 0 };

  assert.equal(releaseTreeBillboardBatchReferences(batch), 0);
  assert.equal(item.userData.lod.billboardBatch.batch, otherBatch);
  assert.deepEqual(batch.state.entries, []);
});
