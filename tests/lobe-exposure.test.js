import assert from 'node:assert/strict';
import test from 'node:test';
import { pointOnLobeSurface } from '../src/generation/lobe-geometry.js';
import {
  buildExposureNeighborhoods,
  calculateLobeClearance,
  prepareExposureLobes,
} from '../src/generation/lobe-exposure.js';

function createLobes() {
  return [
    {
      id: 0,
      position: { x: 0, y: 1, z: 0 },
      rotation: { x: 0.2, y: -0.3, z: 0.1 },
      scale: { x: 1.1, y: 0.8, z: 0.9 },
      boundingRadius: 1.1,
    },
    {
      id: 1,
      position: { x: 1.25, y: 1.2, z: 0.35 },
      rotation: { x: -0.15, y: 0.4, z: -0.22 },
      scale: { x: 0.95, y: 1.2, z: 0.75 },
      boundingRadius: 1.2,
    },
  ];
}

test('prepared exposure lobes preserve rotated clearance exactly', () => {
  const lobes = createLobes();
  const point = { x: 0.65, y: 1.45, z: 0.2 };
  const direct = calculateLobeClearance(point, lobes, 0);
  const prepared = calculateLobeClearance(
    point,
    prepareExposureLobes(lobes),
    0,
  );

  assert.ok(Math.abs(prepared - direct) < 1e-12);
});

test('exposure neighborhoods remove impossible lobes without changing clearance', () => {
  const prepared = prepareExposureLobes([
    ...createLobes(),
    {
      id: 2,
      position: { x: 30, y: 30, z: 30 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      boundingRadius: 1,
    },
  ]);
  const owner = prepared[0];
  const neighborhood = buildExposureNeighborhoods(prepared).get(owner.id);

  assert.deepEqual(
    neighborhood.map((lobe) => lobe.id),
    [1],
  );

  for (const direction of [
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
    { x: 0, y: 0, z: 1 },
  ]) {
    const point = pointOnLobeSurface(owner, direction);
    const full = calculateLobeClearance(point, prepared, owner.id);
    const pruned = calculateLobeClearance(point, neighborhood, owner.id);
    assert.ok(Math.abs(pruned - full) < 1e-12);
  }
});
