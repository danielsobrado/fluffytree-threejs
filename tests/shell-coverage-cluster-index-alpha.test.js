import assert from 'node:assert/strict';
import test from 'node:test';
import { createFoliageAlphaProfile } from '../src/rendering/foliage-alpha-profile.js';
import {
  createShellCoverageClusterIndex,
  findSampleCoverageRatio,
  findTriangleCoverageUpperBound,
} from '../src/qa/shell-coverage-cluster-index.js';

const profile = createFoliageAlphaProfile({
  shapeId: 'broadleaf',
  alphaTest: 0.46,
  planesPerCluster: 1,
});
const cluster = {
  position: { x: 0, y: 0, z: 0 },
  normal: { x: 0, y: 0, z: 1 },
  rotation: 0,
  cardWidth: 1,
  coverageRadius: 1,
  alphaCoverageRadius: profile.guaranteedRadiusRatio,
  leafShape: profile.shapeId,
  alphaTest: profile.alphaTest,
  planesPerCluster: profile.planesPerCluster,
};
const options = {
  minimumCoverageNormalDot: -1,
  targetRatio: 1,
};

test('exact sample coverage rejects transparent UVs', () => {
  const index = createShellCoverageClusterIndex([cluster]);
  const center = findSampleCoverageRatio(
    index,
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 1 },
    options,
  );
  const corner = findSampleCoverageRatio(
    index,
    { x: 0.48, y: 0.48, z: 0 },
    { x: 0, y: 0, z: 1 },
    options,
  );

  assert.equal(center, 0);
  assert.equal(corner, Number.POSITIVE_INFINITY);
});

test('whole-patch certification uses only the guaranteed opaque disk', () => {
  const index = createShellCoverageClusterIndex([cluster]);
  const radius = profile.guaranteedRadiusRatio * 0.5;
  const result = findTriangleCoverageUpperBound(
    index,
    {
      positions: [
        { x: -radius, y: 0, z: 0 },
        { x: radius, y: 0, z: 0 },
        { x: 0, y: radius, z: 0 },
        { x: 0, y: 0, z: 0 },
      ],
      normals: Array.from({ length: 4 }, () => ({ x: 0, y: 0, z: 1 })),
    },
    {
      worldUncertainty: 0,
      normalUncertainty: 0,
      ...options,
    },
  );

  assert.ok(result <= 1);
});
