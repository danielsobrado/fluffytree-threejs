import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BILLBOARD_ATLAS_GUTTER_PIXELS,
  calculateBillboardAtlasSlot,
  calculateBillboardAtlasUvTransform,
  createBillboardAtlasLayout,
} from '../src/rendering/tree-billboard-atlas.js';

const EPSILON = 1e-12;

function assertClose(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= EPSILON, `${actual} != ${expected}`);
}

test('billboard atlas assigns every tree a unique normalized slot', () => {
  const layout = createBillboardAtlasLayout(32);
  assert.deepEqual(layout, { capacity: 32, columns: 6, rows: 6 });

  const first = calculateBillboardAtlasSlot(0, layout);
  const last = calculateBillboardAtlasSlot(31, layout);
  assert.deepEqual(first, {
    column: 0,
    row: 0,
    offsetX: 0,
    offsetY: 5 / 6,
    scaleX: 1 / 6,
    scaleY: 1 / 6,
  });
  assert.equal(last.column, 1);
  assert.equal(last.row, 5);
  assert.equal(last.offsetY, 0);
  assert.ok(last.offsetX + last.scaleX <= 1);
  assert.ok(last.offsetY + last.scaleY <= 1);
});

test('billboard atlas UVs stay half a texel inside their cell', () => {
  const layout = createBillboardAtlasLayout(32);
  const slot = calculateBillboardAtlasSlot(0, layout);
  const uv = calculateBillboardAtlasUvTransform(slot, 768, 768);
  const inset = 0.5 / 768;

  assert.equal(uv.offsetX, inset);
  assert.equal(uv.offsetY, 5 / 6 + inset);
  assert.equal(uv.scaleX, 1 / 6 - inset * 2);
  assert.equal(uv.scaleY, 1 / 6 - inset * 2);
  assertClose(uv.offsetX + uv.scaleX, 1 / 6 - inset);
  assertClose(uv.offsetY + uv.scaleY, 1 - inset);
});

test('billboard atlas UVs exclude mip-safe gutters from sampling', () => {
  const layout = createBillboardAtlasLayout(4);
  const slot = calculateBillboardAtlasSlot(1, layout);
  const stride = 128 + BILLBOARD_ATLAS_GUTTER_PIXELS * 2;
  const width = stride * layout.columns;
  const height = stride * layout.rows;
  const uv = calculateBillboardAtlasUvTransform(
    slot,
    width,
    height,
    BILLBOARD_ATLAS_GUTTER_PIXELS,
  );
  const expectedOffsetX =
    slot.offsetX + (BILLBOARD_ATLAS_GUTTER_PIXELS + 0.5) / width;
  const expectedScale = 127 / width;

  assertClose(uv.offsetX, expectedOffsetX);
  assertClose(uv.scaleX, expectedScale);
  assert.ok(uv.offsetX > slot.offsetX);
  assert.ok(uv.offsetX + uv.scaleX < slot.offsetX + slot.scaleX);
});

test('billboard atlas rejects invalid slots and texture sizes', () => {
  const layout = createBillboardAtlasLayout(4);
  const slot = calculateBillboardAtlasSlot(0, layout);

  assert.throws(() => calculateBillboardAtlasSlot(4, layout), RangeError);
  assert.throws(() => calculateBillboardAtlasUvTransform(slot, 0, 256), RangeError);
  assert.throws(() => calculateBillboardAtlasUvTransform(slot, 256, 0), RangeError);
  assert.throws(
    () => calculateBillboardAtlasUvTransform(slot, 8, 8, 4),
    /too small/,
  );
});
