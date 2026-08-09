import assert from 'node:assert/strict';
import test from 'node:test';
import { FoliageCoverageIndex } from '../src/generation/foliage-coverage-index.js';
import { createFoliageAlphaProfile } from '../src/rendering/foliage-alpha-profile.js';

function createCluster(overrides = {}) {
  const profile = createFoliageAlphaProfile({
    shapeId: 'broadleaf',
    alphaTest: 0.46,
    planesPerCluster: 1,
  });

  return {
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    cardWidth: 1,
    coverageRadius: 1,
    leafShape: profile.shapeId,
    alphaTest: profile.alphaTest,
    planesPerCluster: profile.planesPerCluster,
    alphaProfile: profile,
    ...overrides,
  };
}

test('coverage index rejects points that land in transparent leaf pixels', () => {
  const index = new FoliageCoverageIndex(1);
  index.add(createCluster());

  const candidate = {
    position: { x: 0.48, y: 0.48, z: 0 },
    surfacePoint: { x: 0.48, y: 0.48, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  };

  assert.equal(index.nearestRatio(candidate), Number.POSITIVE_INFINITY);
});

test('coverage index keeps distance coverage for records without alpha metadata', () => {
  const index = new FoliageCoverageIndex(1);
  index.add({
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    coverageRadius: 1,
  });

  const candidate = {
    position: { x: 0.25, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  };

  assert.equal(index.nearestRatio(candidate), 0.25);
});
