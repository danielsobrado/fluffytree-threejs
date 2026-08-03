import { analyzeTriangleSelfIntersections } from './triangle-self-intersection-analyzer.js';

function edgeKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function triangleKey(a, b, c) {
  return [a, b, c].sort((left, right) => left - right).join(':');
}

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }

  find(value) {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];

    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(left, right) {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;

    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    this.parent[rightRoot] = leftRoot;
    if (this.rank[leftRoot] === this.rank[rightRoot]) {
      this.rank[leftRoot] += 1;
    }
  }
}

function calculateBoundsDiagonalSquared(positions) {
  const minimum = [Infinity, Infinity, Infinity];
  const maximum = [-Infinity, -Infinity, -Infinity];

  for (let offset = 0; offset + 2 < positions.length; offset += 3) {
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[offset + axis];
      if (!Number.isFinite(value)) continue;
      minimum[axis] = Math.min(minimum[axis], value);
      maximum[axis] = Math.max(maximum[axis], value);
    }
  }

  if (!minimum.every(Number.isFinite) || !maximum.every(Number.isFinite)) {
    return 0;
  }

  return minimum.reduce((total, value, axis) => {
    const difference = maximum[axis] - value;
    return total + difference * difference;
  }, 0);
}

function calculateDoubleArea(positions, a, b, c) {
  const aOffset = a * 3;
  const bOffset = b * 3;
  const cOffset = c * 3;
  const abX = positions[bOffset] - positions[aOffset];
  const abY = positions[bOffset + 1] - positions[aOffset + 1];
  const abZ = positions[bOffset + 2] - positions[aOffset + 2];
  const acX = positions[cOffset] - positions[aOffset];
  const acY = positions[cOffset + 1] - positions[aOffset + 1];
  const acZ = positions[cOffset + 2] - positions[aOffset + 2];
  const crossX = abY * acZ - abZ * acY;
  const crossY = abZ * acX - abX * acZ;
  const crossZ = abX * acY - abY * acX;
  return Math.hypot(crossX, crossY, crossZ);
}

function calculateSignedVolume(positions, indices) {
  let total = 0;

  for (let offset = 0; offset + 2 < indices.length; offset += 3) {
    const a = indices[offset] * 3;
    const b = indices[offset + 1] * 3;
    const c = indices[offset + 2] * 3;
    const crossX =
      positions[b + 1] * positions[c + 2] -
      positions[b + 2] * positions[c + 1];
    const crossY =
      positions[b + 2] * positions[c] -
      positions[b] * positions[c + 2];
    const crossZ =
      positions[b] * positions[c + 1] -
      positions[b + 1] * positions[c];
    total +=
      positions[a] * crossX +
      positions[a + 1] * crossY +
      positions[a + 2] * crossZ;
  }

  return total / 6;
}

function recordEdge(edges, from, to, triangle) {
  const key = edgeKey(from, to);
  const uses = edges.get(key) ?? [];
  uses.push({
    triangle,
    direction: from < to ? 1 : -1,
  });
  edges.set(key, uses);
}

function countTriangleComponents(triangleSet, edges, triangleCount) {
  if (triangleSet.size === 0) return 0;
  const components = new DisjointSet(triangleCount);

  for (const uses of edges.values()) {
    const first = uses[0]?.triangle;
    if (first === undefined) continue;
    for (let index = 1; index < uses.length; index += 1) {
      components.union(first, uses[index].triangle);
    }
  }

  return new Set([...triangleSet].map((triangle) => components.find(triangle))).size;
}

export function analyzeIndexedManifold(
  positions,
  indices,
  {
    areaEpsilonRatio = 1e-12,
    expectedEulerCharacteristic = 2,
    minimumSignedVolume = 0,
    selfIntersectionEpsilonRatio = 1e-10,
    maximumSelfIntersectionExamples = 8,
  } = {},
) {
  if (!positions || !indices) {
    throw new TypeError('Positions and indices are required.');
  }
  if (!Number.isFinite(areaEpsilonRatio) || areaEpsilonRatio < 0) {
    throw new RangeError('areaEpsilonRatio must be a non-negative number.');
  }
  if (
    !Number.isFinite(selfIntersectionEpsilonRatio) ||
    selfIntersectionEpsilonRatio < 0
  ) {
    throw new RangeError(
      'selfIntersectionEpsilonRatio must be a non-negative number.',
    );
  }
  if (
    !Number.isSafeInteger(maximumSelfIntersectionExamples) ||
    maximumSelfIntersectionExamples < 0
  ) {
    throw new RangeError(
      'maximumSelfIntersectionExamples must be a non-negative integer.',
    );
  }

  const vertexCount = Math.floor(positions.length / 3);
  const triangleCount = Math.floor(indices.length / 3);
  const malformedPositionValueCount = positions.length % 3;
  const malformedIndexValueCount = indices.length % 3;
  const edges = new Map();
  const referencedVertices = new Set();
  const validTriangles = new Set();
  const triangles = new Set();
  const minimumDoubleArea =
    calculateBoundsDiagonalSquared(positions) * areaEpsilonRatio;
  let invalidIndexCount = 0;
  let nonFiniteVertexCount = 0;
  let degenerateTriangleCount = 0;
  let duplicateTriangleCount = 0;

  for (let vertex = 0; vertex < vertexCount; vertex += 1) {
    const offset = vertex * 3;
    if (
      !Number.isFinite(positions[offset]) ||
      !Number.isFinite(positions[offset + 1]) ||
      !Number.isFinite(positions[offset + 2])
    ) {
      nonFiniteVertexCount += 1;
    }
  }

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const offset = triangle * 3;
    const a = indices[offset];
    const b = indices[offset + 1];
    const c = indices[offset + 2];
    const validIndices = [a, b, c].every(
      (index) => Number.isSafeInteger(index) && index >= 0 && index < vertexCount,
    );

    if (!validIndices) {
      invalidIndexCount += 1;
      continue;
    }

    validTriangles.add(triangle);
    referencedVertices.add(a);
    referencedVertices.add(b);
    referencedVertices.add(c);

    const key = triangleKey(a, b, c);
    if (triangles.has(key)) duplicateTriangleCount += 1;
    else triangles.add(key);

    const degenerate =
      a === b ||
      b === c ||
      c === a ||
      calculateDoubleArea(positions, a, b, c) <= minimumDoubleArea;
    if (degenerate) degenerateTriangleCount += 1;

    recordEdge(edges, a, b, triangle);
    recordEdge(edges, b, c, triangle);
    recordEdge(edges, c, a, triangle);
  }

  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  let orientationConflictCount = 0;

  for (const uses of edges.values()) {
    if (uses.length === 1) boundaryEdgeCount += 1;
    else if (uses.length !== 2) nonManifoldEdgeCount += 1;

    if (uses.length === 2 && uses[0].direction === uses[1].direction) {
      orientationConflictCount += 1;
    }
  }

  const componentCount = countTriangleComponents(
    validTriangles,
    edges,
    triangleCount,
  );
  const eulerCharacteristic =
    referencedVertices.size - edges.size + validTriangles.size;
  const canCalculateVolume =
    malformedPositionValueCount === 0 &&
    malformedIndexValueCount === 0 &&
    invalidIndexCount === 0 &&
    nonFiniteVertexCount === 0;
  const signedVolume = canCalculateVolume
    ? calculateSignedVolume(positions, indices)
    : Number.NaN;
  const selfIntersections = analyzeTriangleSelfIntersections(positions, indices, {
    epsilonRatio: selfIntersectionEpsilonRatio,
    maximumExamples: maximumSelfIntersectionExamples,
  });
  const closedTwoManifold =
    triangleCount > 0 &&
    malformedPositionValueCount === 0 &&
    malformedIndexValueCount === 0 &&
    invalidIndexCount === 0 &&
    nonFiniteVertexCount === 0 &&
    degenerateTriangleCount === 0 &&
    duplicateTriangleCount === 0 &&
    boundaryEdgeCount === 0 &&
    nonManifoldEdgeCount === 0 &&
    orientationConflictCount === 0 &&
    selfIntersections.selfIntersectionCount === 0 &&
    componentCount === 1 &&
    eulerCharacteristic === expectedEulerCharacteristic &&
    Number.isFinite(signedVolume) &&
    signedVolume > minimumSignedVolume;

  return Object.freeze({
    vertexCount,
    referencedVertexCount: referencedVertices.size,
    unreferencedVertexCount: vertexCount - referencedVertices.size,
    triangleCount,
    edgeCount: edges.size,
    componentCount,
    eulerCharacteristic,
    expectedEulerCharacteristic,
    minimumSignedVolume,
    malformedPositionValueCount,
    malformedIndexValueCount,
    invalidIndexCount,
    nonFiniteVertexCount,
    degenerateTriangleCount,
    duplicateTriangleCount,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    orientationConflictCount,
    selfIntersectionCount: selfIntersections.selfIntersectionCount,
    selfIntersectionCandidatePairCount: selfIntersections.candidatePairCount,
    selfIntersectionTestedPairCount: selfIntersections.testedPairCount,
    selfIntersectionSkippedTriangleCount: selfIntersections.skippedTriangleCount,
    selfIntersectionEpsilon: selfIntersections.epsilon,
    selfIntersectionExamples: selfIntersections.examples,
    signedVolume,
    outwardFacing: Number.isFinite(signedVolume) && signedVolume > 0,
    closedTwoManifold,
  });
}

export function analyzeBufferGeometryManifold(geometry, options) {
  const positions = geometry?.getAttribute?.('position')?.array;
  const indices = geometry?.getIndex?.()?.array;

  if (!positions || !indices) {
    throw new TypeError('An indexed BufferGeometry with positions is required.');
  }

  return analyzeIndexedManifold(positions, indices, options);
}
