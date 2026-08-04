import assert from 'node:assert/strict';
import test from 'node:test';
import { foliageCardCoverageRatio } from '../src/generation/foliage-card-coverage.js';
import { createFoliageAlphaProfile } from '../src/rendering/foliage-alpha-profile.js';
import { LEAF_SHAPE_IDS } from '../src/rendering/leaf-shape-library.js';

const ALPHA_TEST = 0.46;

test('guaranteed alpha radius is opaque for every leaf shape', () => {
  for (const shapeId of LEAF_SHAPE_IDS) {
    const profile = createFoliageAlphaProfile({
      shapeId,
      alphaTest: ALPHA_TEST,
      planesPerCluster: 2,
    });

    assert.ok(profile.guaranteedRadiusRatio > 0, shapeId);
    assert.ok(profile.guaranteedRadiusRatio <= 0.49, shapeId);

    for (let index = 0; index < 360; index += 1) {
      const angle = (index / 360) * Math.PI * 2;
      const radius = profile.guaranteedRadiusRatio;
      assert.ok(
        profile.isOpaque(Math.cos(angle) * radius, Math.sin(angle) * radius),
        `${shapeId} rejected angle ${index}`,
      );
    }
  }
});

test('coverage checks the filtered alpha mask instead of the card square', () => {
  const profile = createFoliageAlphaProfile({
    shapeId: 'broadleaf',
    alphaTest: ALPHA_TEST,
    planesPerCluster: 1,
  });
  const cluster = {
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    rotation: 0,
    cardWidth: 1,
    coverageRadius: 1,
    alphaCoverageRadius: profile.guaranteedRadiusRatio,
    alphaProfile: profile,
    leafShape: profile.shapeId,
    alphaTest: profile.alphaTest,
    planesPerCluster: profile.planesPerCluster,
  };
  const center = {
    position: { x: 0, y: 0, z: 0 },
    surfacePoint: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  };
  const corner = {
    ...center,
    position: { x: 0.48, y: 0.48, z: 0 },
    surfacePoint: { x: 0.48, y: 0.48, z: 0 },
  };

  assert.equal(foliageCardCoverageRatio(center, cluster), 0);
  assert.equal(
    foliageCardCoverageRatio(corner, cluster),
    Number.POSITIVE_INFINITY,
  );
});
