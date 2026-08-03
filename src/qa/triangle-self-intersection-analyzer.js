function subtract(left, right) {
  return [
    left[0] - right[0],
    left[1] - right[1],
    left[2] - right[2],
  ];
}

function cross(left, right) {
  return [
    left[1] * right[2] - left[2] * right[1],
    left[2] * right[0] - left[0] * right[2],
    left[0] * right[1] - left[1] * right[0],
  ];
}

function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1] + left[2] * right[2];
}

function length(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const magnitude = length(vector);
  if (magnitude <= Number.EPSILON) return null;
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function vertexAt(positions, index) {
  const offset = index * 3;
  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

function createTriangle(positions, indices, triangleIndex) {
  const offset = triangleIndex * 3;
  const vertexIndices = [
    indices[offset],
    indices[offset + 1],
    indices[offset + 2],
  ];
  const vertexCount = Math.floor(positions.length / 3);

  if (
    !vertexIndices.every(
      (index) => Number.isSafeInteger(index) && index >= 0 && index < vertexCount,
    )
  ) {
    return null;
  }

  const vertices = vertexIndices.map((index) => vertexAt(positions, index));
  if (!vertices.flat().every(Number.isFinite)) return null;

  const edges = [
    subtract(vertices[1], vertices[0]),
    subtract(vertices[2], vertices[1]),
    subtract(vertices[0], vertices[2]),
  ];
  const normal = normalize(cross(edges[0], subtract(vertices[2], vertices[0])));
  if (!normal) return null;

  return {
    id: triangleIndex,
    vertexIndices,
    vertices,
    edges,
    normal,
    minimum: [
      Math.min(...vertices.map((vertex) => vertex[0])),
      Math.min(...vertices.map((vertex) => vertex[1])),
      Math.min(...vertices.map((vertex) => vertex[2])),
    ],
    maximum: [
      Math.max(...vertices.map((vertex) => vertex[0])),
      Math.max(...vertices.map((vertex) => vertex[1])),
      Math.max(...vertices.map((vertex) => vertex[2])),
    ],
  };
}

function calculateBoundsDiagonal(positions) {
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

  return Math.hypot(
    maximum[0] - minimum[0],
    maximum[1] - minimum[1],
    maximum[2] - minimum[2],
  );
}

function intervalsOverlap(left, right, epsilon) {
  return left.maximum >= right.minimum - epsilon &&
    right.maximum >= left.minimum - epsilon;
}

function project3d(vertices, axis) {
  const values = vertices.map((vertex) => dot(vertex, axis));
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
}

function separatedOnAxis(left, right, axis, epsilon) {
  const normalizedAxis = normalize(axis);
  if (!normalizedAxis) return false;
  return !intervalsOverlap(
    project3d(left.vertices, normalizedAxis),
    project3d(right.vertices, normalizedAxis),
    epsilon,
  );
}

function dominantAxis(normal) {
  const absolute = normal.map(Math.abs);
  if (absolute[0] >= absolute[1] && absolute[0] >= absolute[2]) return 0;
  return absolute[1] >= absolute[2] ? 1 : 2;
}

function projectTo2d(vertex, droppedAxis) {
  if (droppedAxis === 0) return [vertex[1], vertex[2]];
  if (droppedAxis === 1) return [vertex[0], vertex[2]];
  return [vertex[0], vertex[1]];
}

function project2d(vertices, axis) {
  const values = vertices.map(
    (vertex) => vertex[0] * axis[0] + vertex[1] * axis[1],
  );
  return { minimum: Math.min(...values), maximum: Math.max(...values) };
}

function coplanarTrianglesIntersect(left, right, epsilon) {
  const droppedAxis = dominantAxis(left.normal);
  const leftVertices = left.vertices.map((vertex) =>
    projectTo2d(vertex, droppedAxis),
  );
  const rightVertices = right.vertices.map((vertex) =>
    projectTo2d(vertex, droppedAxis),
  );
  const polygons = [leftVertices, rightVertices];

  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const edge = [next[0] - current[0], next[1] - current[1]];
      const axisLength = Math.hypot(edge[0], edge[1]);
      if (axisLength <= Number.EPSILON) continue;
      const axis = [-edge[1] / axisLength, edge[0] / axisLength];

      if (
        !intervalsOverlap(
          project2d(leftVertices, axis),
          project2d(rightVertices, axis),
          epsilon,
        )
      ) {
        return false;
      }
    }
  }

  return true;
}

function areCoplanar(left, right, epsilon) {
  const normalCross = length(cross(left.normal, right.normal));
  if (normalCross > 1e-8) return false;
  const planeDistance = Math.abs(
    dot(left.normal, subtract(right.vertices[0], left.vertices[0])),
  );
  return planeDistance <= epsilon;
}

function trianglesIntersect(left, right, epsilon) {
  if (areCoplanar(left, right, epsilon)) {
    return coplanarTrianglesIntersect(left, right, epsilon);
  }

  if (separatedOnAxis(left, right, left.normal, epsilon)) return false;
  if (separatedOnAxis(left, right, right.normal, epsilon)) return false;

  for (const leftEdge of left.edges) {
    for (const rightEdge of right.edges) {
      if (separatedOnAxis(left, right, cross(leftEdge, rightEdge), epsilon)) {
        return false;
      }
    }
  }

  return true;
}

function sharesVertex(left, right) {
  return left.vertexIndices.some((index) => right.vertexIndices.includes(index));
}

function aabbsOverlap(left, right, epsilon) {
  for (let axis = 0; axis < 3; axis += 1) {
    if (
      left.maximum[axis] < right.minimum[axis] - epsilon ||
      right.maximum[axis] < left.minimum[axis] - epsilon
    ) {
      return false;
    }
  }
  return true;
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
    throw new RangeError('Self-intersection maximumExamples must be a non-negative integer.');
  }

  const triangleCount = Math.floor(indices.length / 3);
  const triangles = [];
  let skippedTriangleCount = 0;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const triangle = createTriangle(positions, indices, triangleIndex);
    if (triangle) triangles.push(triangle);
    else skippedTriangleCount += 1;
  }

  triangles.sort(
    (left, right) => left.minimum[0] - right.minimum[0] || left.id - right.id,
  );

  const epsilon = Math.max(
    calculateBoundsDiagonal(positions) * epsilonRatio,
    Number.EPSILON * 16,
  );
  const active = [];
  const examples = [];
  let candidatePairCount = 0;
  let testedPairCount = 0;
  let selfIntersectionCount = 0;

  for (const triangle of triangles) {
    for (let index = active.length - 1; index >= 0; index -= 1) {
      if (active[index].maximum[0] < triangle.minimum[0] - epsilon) {
        active.splice(index, 1);
      }
    }

    for (const candidate of active) {
      if (!aabbsOverlap(candidate, triangle, epsilon)) continue;
      candidatePairCount += 1;
      if (sharesVertex(candidate, triangle)) continue;
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
