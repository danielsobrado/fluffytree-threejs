import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDeterministicFoliageMaxCover } from '../src/generation/foliage-max-cover-selector.js';
import { createFoliageAlphaProfile } from '../src/rendering/foliage-alpha-profile.js';

const profile = createFoliageAlphaProfile({
  shapeId: 'broadleaf',
  alphaTest: 0.46,
  planesPerCluster: 1,
});

function createItem(id, x, y, score) {
  return {
    id,
    candidateIndex: id,
    lobeId: 0,
    score,
    exposure: score,
    position: { x, y, z: 0 },
    surfacePoint: { x, y, z: 0 },
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
}

test('max-cover does not let transparent card corners suppress candidates', () => {
  const result = selectDeterministicFoliageMaxCover([
    createItem(0, 0, 0, 1),
    createItem(1, 0.48, 0.48, 0.9),
  ]);

  assert.deepEqual(result.selected.map((item) => item.id), [0, 1]);
});

test('max-cover still suppresses candidates on opaque texels', () => {
  const result = selectDeterministicFoliageMaxCover([
    createItem(0, 0, 0, 1),
    createItem(1, 0.02, 0.02, 0.9),
  ]);

  assert.deepEqual(result.selected.map((item) => item.id), [0]);
});
