import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeTriangleSelfIntersections } from '../src/qa/triangle-self-intersection-analyzer.js';

function analyze(positions, indices) {
  return analyzeTriangleSelfIntersections(positions, indices, {
    epsilonRatio: 1e-10,
    maximumExamples: 4,
  });
}

test('accepts separated non-adjacent triangles', () => {
  const report = analyze(
    [
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      2, 0, 0,
      3, 0, 0,
      2, 1, 0,
    ],
    [0, 1, 2, 3, 4, 5],
  );

  assert.equal(report.selfIntersectionCount, 0);
  assert.equal(report.testedPairCount, 0);
});

test('detects non-coplanar triangle crossings', () => {
  const report = analyze(
    [
      0, 0, 0,
      2, 0, 0,
      1, 2, 0,
      1, -1, -1,
      1, 1, 1,
      1, 1, -1,
    ],
    [0, 1, 2, 3, 4, 5],
  );

  assert.equal(report.selfIntersectionCount, 1);
  assert.deepEqual(report.examples, [
    { leftTriangle: 0, rightTriangle: 1 },
  ]);
});

test('detects coplanar triangle overlap', () => {
  const report = analyze(
    [
      0, 0, 0,
      2, 0, 0,
      0, 2, 0,
      0.5, 0.5, 0,
      2, 0.5, 0,
      0.5, 2, 0,
    ],
    [0, 1, 2, 3, 4, 5],
  );

  assert.equal(report.selfIntersectionCount, 1);
});

test('ignores topological neighbours that share a vertex', () => {
  const report = analyze(
    [
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
      1, 1, 1,
    ],
    [0, 1, 2, 0, 3, 4],
  );

  assert.equal(report.candidatePairCount, 1);
  assert.equal(report.testedPairCount, 0);
  assert.equal(report.selfIntersectionCount, 0);
});
