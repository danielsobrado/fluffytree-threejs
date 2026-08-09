import assert from 'node:assert/strict';
import test from 'node:test';
import { lobeAxisAlignedExtents } from '../src/generation/lobe-geometry.js';

function close(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

test('rotated lobe extents follow the rendered ellipsoid orientation', () => {
  const quarterTurn = lobeAxisAlignedExtents({
    scale: { x: 2, y: 1, z: 0.5 },
    rotation: { x: 0, y: 0, z: Math.PI / 2 },
  });

  close(quarterTurn.x, 1);
  close(quarterTurn.y, 2);
  close(quarterTurn.z, 0.5);
});

test('diagonal lobe extents combine rotated semi axes quadratically', () => {
  const diagonal = lobeAxisAlignedExtents({
    scale: { x: 2, y: 1, z: 0.5 },
    rotation: { x: 0, y: 0, z: Math.PI / 4 },
  });
  const expected = Math.sqrt(2.5);

  close(diagonal.x, expected);
  close(diagonal.y, expected);
  close(diagonal.z, 0.5);
});
