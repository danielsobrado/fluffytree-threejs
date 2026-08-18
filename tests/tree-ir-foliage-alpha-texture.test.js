import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeIrFoliageAlphaTexture } from '../src/rendering/tree-ir-foliage-alpha-texture.js';

function alphaBytes(texture) {
  const data = texture.image.data;
  return Array.from({ length: data.length / 4 }, (_unused, index) =>
    data[index * 4 + 3],
  );
}

function redBytes(texture) {
  const data = texture.image.data;
  return Array.from({ length: data.length / 4 }, (_unused, index) =>
    data[index * 4],
  );
}

test('native broadleaf alpha textures preserve requested spray silhouettes', () => {
  const broadleaf = createTreeIrFoliageAlphaTexture(
    'broadleaf-spray',
    48,
    'broadleaf',
  );
  const oval = createTreeIrFoliageAlphaTexture(
    'broadleaf-spray',
    48,
    'oval',
  );

  try {
    assert.match(broadleaf.name, /broadleaf-alpha$/);
    assert.match(oval.name, /oval-alpha$/);
    assert.notDeepEqual(alphaBytes(broadleaf), alphaBytes(oval));
  } finally {
    broadleaf.dispose();
    oval.dispose();
  }
});

test('needle primitive family always uses the needle alpha profile', () => {
  const requestedOval = createTreeIrFoliageAlphaTexture(
    'needle-cluster',
    32,
    'oval',
  );
  const requestedBroadleaf = createTreeIrFoliageAlphaTexture(
    'needle-cluster',
    32,
    'broadleaf',
  );

  try {
    assert.match(requestedOval.name, /needle-alpha$/);
    assert.deepEqual(alphaBytes(requestedOval), alphaBytes(requestedBroadleaf));
  } finally {
    requestedOval.dispose();
    requestedBroadleaf.dispose();
  }
});

test('native foliage surface detail preserves alpha while breaking flat albedo', () => {
  const flat = createTreeIrFoliageAlphaTexture('broadleaf', 48, 'oval');
  const detailed = createTreeIrFoliageAlphaTexture('broadleaf', 48, 'oval', {
    surfaceMottle: 0.06,
    surfaceEdgeDarkening: 0.08,
    surfaceVerticalTint: 0.05,
  });

  try {
    assert.deepEqual(alphaBytes(flat), alphaBytes(detailed));
    assert.notDeepEqual(redBytes(flat), redBytes(detailed));
    assert.ok(redBytes(detailed).some((value) => value < 245));
    assert.equal(detailed.userData.foliageSurface.surfaceMottle, 0.06);
  } finally {
    flat.dispose();
    detailed.dispose();
  }
});
