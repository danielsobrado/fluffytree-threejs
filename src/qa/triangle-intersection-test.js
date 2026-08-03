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

function vectorLength(vector) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector) {
  const magnitude = vectorLength(vector);
  if (magnitude <= Number.EPSILON) return null;
  return [vector[0] / magnitude, vector[1] / magnitude, vector[2] / magnitude];
}

function vertexAt(positions, index) {
  const offset = index * 3;
  return [positions[offset], positions[offset + 1], positions[offset + 2]];
}

export function createTriangleRecord(positions, indices, triangleIndex) {
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

export function calculatePositionBoundsDiagonal(positions) {
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

  for (const polygon of [leftVertices, rightVertices]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const next = polygon[(index + 1) % polygon.length];
      const edge = [next[0] - current[0], next[1] - current[1]];
      const magnitude = Math.hypot(edge[0], edge[1]);
      if (magnitude <= Number.EPSILON) continue;
      const axis = [-edge[1] / magnitude, edge[0] / magnitude];

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
  if (vectorLength(cross(left.normal, right.normal)) > 1e-8) return false;
  const planeDistance = Math.abs(
    dot(left.normal, subtract(right.vertices[0], left.vertices[0])),
  );
  return planeDistance <= epsilon;
}

export function trianglesIntersect(left, right, epsilon) {
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

export function trianglesShareIndexedVertex(left, right) {
  return left.vertexIndices.some((index) => right.vertexIndices.includes(index));
}

export function trianglesHaveOverlappingBounds(left, right, epsilon) {
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
