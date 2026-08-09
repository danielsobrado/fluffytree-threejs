import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createLobeProjection,
  projectedLobeContains,
  projectedLobeRow,
} from '../src/qa/lobe-projection.js';

function close(actual, expected, epsilon = 1e-12) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

function createLobe(rotationZ) {
  return {
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 2, y: 1, z: 0.5 },
    rotation: { x: 0, y: 0, z: rotationZ },
  };
}

test('orthographic lobe projection includes tilt covariance', () => {
  const projection = createLobeProjection(createLobe(Math.PI / 4), 'x');

  close(projection.horizontalExtent, Math.sqrt(2.5));
  close(projection.verticalExtent, Math.sqrt(2.5));
  close(projection.xy, 1.5);

  const row = projectedLobeRow(projection, 0.5);
  close(row.minimum + row.maximum, 0.6);
  assert.equal(projectedLobeContains(projection, 0.3, 0.5), true);
  assert.equal(projectedLobeContains(projection, 2, 0.5), false);
});

test('quarter-turn projection swaps horizontal and vertical semi axes', () => {
  const projection = createLobeProjection(createLobe(Math.PI / 2), 'x');

  close(projection.horizontalExtent, 1);
  close(projection.verticalExtent, 2);
  const row = projectedLobeRow(projection, 0);
  close(row.minimum, -1);
  close(row.maximum, 1);
});

test('unsupported projection axes fail fast', () => {
  assert.throws(
    () => createLobeProjection(createLobe(0), 'y'),
    /Unsupported lobe projection axis/,
  );
});
