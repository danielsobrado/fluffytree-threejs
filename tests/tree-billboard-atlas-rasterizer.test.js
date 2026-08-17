import assert from 'node:assert/strict';
import test from 'node:test';
import { drawBillboardAtlasCell } from '../src/rendering/tree-billboard-atlas-rasterizer.js';

function createContext() {
  const calls = [];
  return {
    calls,
    drawImage(...args) {
      calls.push(args);
    },
  };
}

test('billboard atlas rasterizer fills center, edges and corners of its gutter', () => {
  const context = createContext();
  const image = { width: 128, height: 128 };

  drawBillboardAtlasCell(context, image, 136, 272, 4);

  assert.equal(context.calls.length, 9);
  assert.deepEqual(context.calls[0], [image, 140, 276, 128, 128]);
  assert.deepEqual(context.calls[1], [image, 0, 0, 1, 128, 136, 276, 4, 128]);
  assert.deepEqual(context.calls.at(-1), [
    image,
    127,
    127,
    1,
    1,
    268,
    404,
    4,
    4,
  ]);
});

test('zero gutter draws only the source image', () => {
  const context = createContext();
  const image = { width: 32, height: 24 };

  drawBillboardAtlasCell(context, image, 0, 0, 0);

  assert.deepEqual(context.calls, [[image, 0, 0, 32, 24]]);
});

test('billboard atlas rasterizer validates source and gutter', () => {
  const context = createContext();

  assert.throws(
    () => drawBillboardAtlasCell(context, { width: 0, height: 1 }, 0, 0, 4),
    /positive dimensions/,
  );
  assert.throws(
    () => drawBillboardAtlasCell(context, { width: 1, height: 1 }, 0, 0, -1),
    /non-negative integer/,
  );
});
