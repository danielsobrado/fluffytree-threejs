import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateBillboardAtlasSlot,
  createBillboardAtlasLayout,
} from '../src/rendering/tree-billboard-atlas.js';

test('billboard atlas assigns every tree a unique normalized slot', () => {
  const layout = createBillboardAtlasLayout(32);
  assert.deepEqual(layout, { capacity: 32, columns: 6, rows: 6 });

  const first = calculateBillboardAtlasSlot(0, layout);
  const last = calculateBillboardAtlasSlot(31, layout);
  assert.deepEqual(first, {
    column: 0,
    row: 0,
    offsetX: 0,
    offsetY: 0,
    scaleX: 1 / 6,
    scaleY: 1 / 6,
  });
  assert.equal(last.column, 1);
  assert.equal(last.row, 5);
  assert.ok(last.offsetX + last.scaleX <= 1);
  assert.ok(last.offsetY + last.scaleY <= 1);
});

test('billboard atlas rejects invalid slots', () => {
  const layout = createBillboardAtlasLayout(4);
  assert.throws(() => calculateBillboardAtlasSlot(4, layout), RangeError);
});
