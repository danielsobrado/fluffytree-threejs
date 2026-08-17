import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeIrFoliageAlphaTexture } from '../src/rendering/tree-ir-foliage-alpha-texture.js';

function alphaBytes(texture) {
  const data = texture.image.data;
  return Array.from({ length: data.length / 4 }, (_unused, index) =>
    data[index * 4 + 3],
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
