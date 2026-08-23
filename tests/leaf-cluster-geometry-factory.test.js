import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LeafClusterGeometryFactory,
  resolveLeafTriangleCountPerLeaf,
} from '../src/rendering/leaf-cluster-geometry-factory.js';

const SETTINGS = Object.freeze({
  leavesPerCluster: 3,
  embedRatio: 0.14,
  protrusionRatio: 0.22,
});

test('leaf cluster factory preserves two-triangle diamond fallback', () => {
  const geometry = new LeafClusterGeometryFactory().create(SETTINGS);

  assert.equal(resolveLeafTriangleCountPerLeaf(), 2);
  assert.equal(geometry.userData.heroLeaves.shape, 'diamond');
  assert.equal(geometry.userData.heroLeaves.triangleCount, 6);
  geometry.dispose();
});

test('leaf cluster factory creates opaque oval leaves with four triangles', () => {
  const policy = {
    shape: 'oval',
    lengthMultiplier: 1.02,
    widthMultiplier: 1.18,
    shoulderRatio: 0.3,
    midRatio: 0.64,
    shoulderWidthRatio: 0.72,
  };
  const geometry = new LeafClusterGeometryFactory().create(SETTINGS, policy);

  assert.equal(resolveLeafTriangleCountPerLeaf(policy), 4);
  assert.equal(geometry.userData.heroLeaves.shape, 'oval');
  assert.equal(geometry.userData.heroLeaves.triangleCount, 12);
  assert.equal(geometry.index.count, 36);
  geometry.dispose();
});
