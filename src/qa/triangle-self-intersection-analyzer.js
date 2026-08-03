import {
  calculatePositionBoundsDiagonal,
  createTriangleRecord,
  trianglesHaveOverlappingBounds,
  trianglesIntersect,
  trianglesShareIndexedVertex,
} from './triangle-intersection-test.js';

function createTriangleRecords(positions, indices) {
  const triangleCount = Math.floor(indices.length / 3);
  const triangles = [];
  let skippedTriangleCount = 0;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const triangle = createTriangleRecord(positions, indices, triangleIndex);
    if (triangle) triangles.push(triangle);
    else skippedTriangleCount += 1;
  }

  triangles.sort(
    (left, right) => left.minimum[0] - right.minimum[0] || left.id - right.id,
  );
  return { triangleCount, triangles, skippedTriangleCount };
}

function removeExpiredTriangles(active, minimumX, epsilon) {
  for (let index = active.length - 1; index >= 0; index -= 1) {
    if (active[index].maximum[0] < minimumX - epsilon) {
      active.splice(index, 1);
    }
  }
}

export function analyzeTriangleSelfIntersections(
  positions,
  indices,
  {
    epsilonRatio = 1e-10,
    maximumExamples = 8,
  } = {},
) {
  if (!positions || !indices) {
    throw new TypeError('Positions and indices are required.');
  }
  if (!Number.isFinite(epsilonRatio) || epsilonRatio < 0) {
    throw new RangeError('Self-intersection epsilonRatio must be non-negative.');
  }
  if (!Number.isSafeInteger(maximumExamples) || maximumExamples < 0) {
    throw new RangeError(
      'Self-intersection maximumExamples must be a non-negative integer.',
    );
  }

  const { triangleCount, triangles, skippedTriangleCount } =
    createTriangleRecords(positions, indices);
  const epsilon = Math.max(
    calculatePositionBoundsDiagonal(positions) * epsilonRatio,
    Number.EPSILON * 16,
  );
  const active = [];
  const examples = [];
  let candidatePairCount = 0;
  let testedPairCount = 0;
  let selfIntersectionCount = 0;

  for (const triangle of triangles) {
    removeExpiredTriangles(active, triangle.minimum[0], epsilon);

    for (const candidate of active) {
      if (!trianglesHaveOverlappingBounds(candidate, triangle, epsilon)) continue;
      candidatePairCount += 1;
      if (trianglesShareIndexedVertex(candidate, triangle)) continue;
      testedPairCount += 1;
      if (!trianglesIntersect(candidate, triangle, epsilon)) continue;

      selfIntersectionCount += 1;
      if (examples.length < maximumExamples) {
        examples.push(
          Object.freeze({
            leftTriangle: candidate.id,
            rightTriangle: triangle.id,
          }),
        );
      }
    }

    active.push(triangle);
  }

  return Object.freeze({
    triangleCount,
    analyzedTriangleCount: triangles.length,
    skippedTriangleCount,
    epsilon,
    candidatePairCount,
    testedPairCount,
    selfIntersectionCount,
    examples: Object.freeze(examples),
  });
}
