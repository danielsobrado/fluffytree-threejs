import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeIndexedManifold } from '../src/qa/mesh-manifold-analyzer.js';

const TETRAHEDRON_POSITIONS = Object.freeze([
  0, 0, 0,
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
]);

const TETRAHEDRON_INDICES = Object.freeze([
  0, 2, 1,
  0, 1, 3,
  0, 3, 2,
  1, 2, 3,
]);

test('accepts a connected outward-facing closed two-manifold', () => {
  const report = analyzeIndexedManifold(
    TETRAHEDRON_POSITIONS,
    TETRAHEDRON_INDICES,
  );

  assert.equal(report.closedTwoManifold, true);
  assert.equal(report.boundaryEdgeCount, 0);
  assert.equal(report.nonManifoldEdgeCount, 0);
  assert.equal(report.orientationConflictCount, 0);
  assert.equal(report.componentCount, 1);
  assert.equal(report.eulerCharacteristic, 2);
  assert.ok(report.signedVolume > 0);
});

test('rejects an open surface', () => {
  const report = analyzeIndexedManifold(
    TETRAHEDRON_POSITIONS,
    TETRAHEDRON_INDICES.slice(0, -3),
  );

  assert.equal(report.closedTwoManifold, false);
  assert.equal(report.boundaryEdgeCount, 3);
});

test('rejects inconsistent triangle orientation', () => {
  const indices = [...TETRAHEDRON_INDICES];
  [indices[0], indices[1]] = [indices[1], indices[0]];
  const report = analyzeIndexedManifold(TETRAHEDRON_POSITIONS, indices);

  assert.equal(report.closedTwoManifold, false);
  assert.equal(report.orientationConflictCount, 3);
});

test('rejects disconnected closed components', () => {
  const translated = TETRAHEDRON_POSITIONS.map((value, index) =>
    index % 3 === 0 ? value + 3 : value,
  );
  const positions = [...TETRAHEDRON_POSITIONS, ...translated];
  const indices = [
    ...TETRAHEDRON_INDICES,
    ...TETRAHEDRON_INDICES.map((index) => index + 4),
  ];
  const report = analyzeIndexedManifold(positions, indices);

  assert.equal(report.closedTwoManifold, false);
  assert.equal(report.componentCount, 2);
  assert.equal(report.eulerCharacteristic, 4);
});

test('rejects degenerate and duplicate triangles', () => {
  const report = analyzeIndexedManifold(
    TETRAHEDRON_POSITIONS,
    [...TETRAHEDRON_INDICES, 0, 2, 1, 0, 0, 1],
  );

  assert.equal(report.closedTwoManifold, false);
  assert.equal(report.duplicateTriangleCount, 1);
  assert.equal(report.degenerateTriangleCount, 1);
});
