import assert from 'node:assert/strict';
import test from 'node:test';
import { CrownVolumeField } from '../src/generation/crown-volume-field.js';
import { inverseRotateVectorEuler } from '../src/generation/lobe-geometry.js';

function createTreeData() {
  return {
    seed: 17,
    lobes: [
      {
        id: 0,
        position: { x: 1.2, y: 2.4, z: -0.7 },
        rotation: { x: 0.31, y: -0.42, z: 0.18 },
        scale: { x: 1.4, y: 0.8, z: 1.1 },
      },
    ],
    palette: {
      volume: {
        smoothing: 0.5,
        padding: 0.2,
        noiseAmplitude: 0,
        noiseFrequency: 1.2,
        normalEpsilon: 0.01,
      },
    },
  };
}

test('crown volume sample matches direct inverse-rotation distance', () => {
  const treeData = createTreeData();
  const lobe = treeData.lobes[0];
  const point = { x: 2.1, y: 2.9, z: -0.1 };
  const local = inverseRotateVectorEuler(
    {
      x: point.x - lobe.position.x,
      y: point.y - lobe.position.y,
      z: point.z - lobe.position.z,
    },
    lobe.rotation,
  );
  const normalizedLength = Math.hypot(
    local.x / lobe.scale.x,
    local.y / lobe.scale.y,
    local.z / lobe.scale.z,
  );
  const expected =
    (normalizedLength - 1) *
    Math.min(lobe.scale.x, lobe.scale.y, lobe.scale.z);

  const field = new CrownVolumeField(treeData);
  assert.ok(Math.abs(field.sample(point) - expected) < 1e-12);
});

test('crown volume gradient remains normalized after transform caching', () => {
  const gradient = new CrownVolumeField(createTreeData()).gradient({
    x: 1.9,
    y: 2.6,
    z: -0.4,
  });
  const length = Math.hypot(gradient.x, gradient.y, gradient.z);

  assert.ok(Number.isFinite(length));
  assert.ok(Math.abs(length - 1) < 1e-9);
});
