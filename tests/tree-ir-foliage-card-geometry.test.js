import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeIrFoliageCardGeometry } from '../src/rendering/tree-ir-foliage-card-geometry.js';

function normals(geometry) {
  const attribute = geometry.getAttribute('normal');
  return Array.from({ length: attribute.count }, (_unused, index) => ({
    x: attribute.getX(index),
    y: attribute.getY(index),
    z: attribute.getZ(index),
  }));
}

test('bent foliage normals preserve geometry cost while softening card lighting', () => {
  const flat = createTreeIrFoliageCardGeometry({
    planeCount: 3,
    depthSpread: 0.08,
    normalBlend: 0,
    normalUpBias: 0,
  });
  const bent = createTreeIrFoliageCardGeometry({
    planeCount: 3,
    depthSpread: 0.08,
    normalBlend: 0.72,
    normalUpBias: 0.24,
  });

  try {
    assert.equal(
      bent.getAttribute('position').count,
      flat.getAttribute('position').count,
    );
    assert.equal(bent.index.count, flat.index.count);
    assert.notDeepEqual(normals(bent), normals(flat));

    const bentNormals = normals(bent);
    const averageUp =
      bentNormals.reduce((sum, normal) => sum + normal.y, 0) /
      bentNormals.length;
    assert.ok(averageUp > 0.05);

    for (const normal of bentNormals) {
      const length = Math.hypot(normal.x, normal.y, normal.z);
      assert.ok(Math.abs(length - 1) < 1e-5);
    }
  } finally {
    flat.dispose();
    bent.dispose();
  }
});
