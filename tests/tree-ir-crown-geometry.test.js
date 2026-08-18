import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeIrCrownGeometry } from '../src/rendering/tree-ir-crown-geometry.js';

function radiusRange(geometry) {
  const positions = geometry.getAttribute('position');
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = 0;
  for (let index = 0; index < positions.count; index += 1) {
    const radius = Math.hypot(
      positions.getX(index),
      positions.getY(index),
      positions.getZ(index),
    );
    minimum = Math.min(minimum, radius);
    maximum = Math.max(maximum, radius);
  }
  return { minimum, maximum };
}

function minimumRadialNormalAlignment(geometry) {
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  let minimum = 1;
  for (let index = 0; index < positions.count; index += 1) {
    const px = positions.getX(index);
    const py = positions.getY(index);
    const pz = positions.getZ(index);
    const length = Math.hypot(px, py, pz);
    const dot =
      (px * normals.getX(index) +
        py * normals.getY(index) +
        pz * normals.getZ(index)) /
      length;
    minimum = Math.min(minimum, dot);
  }
  return minimum;
}

test('native crown geometry breaks the perfect sphere silhouette conservatively', () => {
  const geometry = createTreeIrCrownGeometry(1, 0.07);

  try {
    const range = radiusRange(geometry);
    assert.ok(range.minimum >= 0.93);
    assert.ok(range.maximum <= 1.07);
    assert.ok(range.maximum - range.minimum > 0.04);
    assert.ok(geometry.boundingSphere);
  } finally {
    geometry.dispose();
  }
});

test('organic crown deformation keeps smooth radial lighting normals', () => {
  const geometry = createTreeIrCrownGeometry(1, 0.07);

  try {
    assert.ok(minimumRadialNormalAlignment(geometry) > 0.999999);
  } finally {
    geometry.dispose();
  }
});
