import assert from 'node:assert/strict';
import test from 'node:test';
import { foliageCardCoverageRatio } from '../src/generation/foliage-card-coverage.js';
import {
  createFoliageAlphaPixels,
  createFoliageAlphaProfile,
} from '../src/rendering/foliage-alpha-profile.js';
import {
  DEFAULT_LEAF_SHAPE_ID,
  LEAF_SHAPE_IDS,
} from '../src/rendering/leaf-shape-library.js';

const ALPHA_TEST = 0.46;

test('default foliage alpha profile resolves to the canonical broadleaf shape', () => {
  const implicit = createFoliageAlphaProfile({
    alphaTest: ALPHA_TEST,
    planesPerCluster: 2,
  });
  const explicit = createFoliageAlphaProfile({
    shapeId: DEFAULT_LEAF_SHAPE_ID,
    alphaTest: ALPHA_TEST,
    planesPerCluster: 2,
  });

  assert.equal(implicit.shapeId, DEFAULT_LEAF_SHAPE_ID);
  assert.equal(implicit, explicit);
});

test('alpha profiles expose stable opaque area for shape-aware coverage', () => {
  const ratios = new Map();

  for (const shapeId of LEAF_SHAPE_IDS) {
    const profile = createFoliageAlphaProfile({
      shapeId,
      alphaTest: ALPHA_TEST,
      planesPerCluster: 2,
    });

    assert.ok(profile.opaqueAreaRatio > 0, shapeId);
    assert.ok(profile.opaqueAreaRatio <= 1, shapeId);
    ratios.set(shapeId, profile.opaqueAreaRatio);
  }

  assert.ok(ratios.get('needle') < ratios.get('broadleaf'));
  assert.ok(ratios.get('maple') < ratios.get('oval'));
});

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

test('cached alpha pixels remain detached for callers', () => {
  const first = createFoliageAlphaPixels('broadleaf', 32);
  const second = createFoliageAlphaPixels('broadleaf', 32);

  assert.notEqual(first, second);
  assert.deepEqual(first, second);

  const original = second[0];
  first[0] = original === 255 ? 0 : 255;

  const third = createFoliageAlphaPixels('broadleaf', 32);
  assert.equal(third[0], original);
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
