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

function colorRange(geometry) {
  const colors = geometry.getAttribute('color');
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (let index = 0; index < colors.count; index += 1) {
    const value = colors.getX(index);
    minimum = Math.min(minimum, value);
    maximum = Math.max(maximum, value);
    assert.equal(value, colors.getY(index));
    assert.equal(value, colors.getZ(index));
  }
  return { minimum, maximum };
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

test('crown local depth shading varies color without changing topology', () => {
  const plain = createTreeIrCrownGeometry(1, 0.07, 0);
  const shaded = createTreeIrCrownGeometry(1, 0.07, 0.14);

  try {
    assert.equal(
      shaded.getAttribute('position').count,
      plain.getAttribute('position').count,
    );
    assert.equal(shaded.index?.count ?? 0, plain.index?.count ?? 0);
    const plainRange = colorRange(plain);
    const shadedRange = colorRange(shaded);
    assert.equal(plainRange.minimum, 1);
    assert.equal(plainRange.maximum, 1);
    assert.ok(shadedRange.minimum < 1);
    assert.ok(shadedRange.maximum > 1);
    assert.ok(shadedRange.maximum - shadedRange.minimum > 0.05);
  } finally {
    plain.dispose();
    shaded.dispose();
  }
});
