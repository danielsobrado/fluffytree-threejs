import assert from 'node:assert/strict';
import test from 'node:test';
import { createRenderableTreeIrStemPath } from '../src/rendering/tree-ir-render-path.js';

test('two-point Tree IR stems gain a midpoint for tapered tube rendering', () => {
  const source = [
    { x: 0, y: 0, z: 0 },
    { x: 4, y: 6, z: 2 },
  ];
  const path = createRenderableTreeIrStemPath(source);

  assert.deepEqual(path, [
    source[0],
    { x: 2, y: 3, z: 1 },
    source[1],
  ]);
  assert.equal(path[0], source[0]);
  assert.equal(path[2], source[1]);
});

test('existing renderable Tree IR paths are reused without allocation', () => {
  const source = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 1, z: 0 },
    { x: 2, y: 2, z: 0 },
  ];

  assert.equal(createRenderableTreeIrStemPath(source), source);
});

test('render path adapter rejects invalid logical paths', () => {
  assert.throws(() => createRenderableTreeIrStemPath([]), /at least two points/);
});
