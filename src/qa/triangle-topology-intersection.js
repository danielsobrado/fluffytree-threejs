import { trianglesIntersect } from './triangle-intersection-test.js';

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
  return vector.map((value) => value / magnitude);
}

function sharedVertexIndices(left, right) {
  const rightIndices = new Set(right.vertexIndices);
  return left.vertexIndices.filter((index) => rightIndices.has(index));
}

function pointForIndex(triangle, index) {
  const localIndex = triangle.vertexIndices.indexOf(index);
  return localIndex < 0 ? null : triangle.vertices[localIndex];
}

function planesAreCoplanar(left, right, epsilon) {
  if (length(cross(left.normal, right.normal)) > 1e-8) return false;
  return (
    Math.abs(
      dot(
        left.normal,
        subtract(right.vertices[0], left.vertices[0]),
      ),
    ) <= epsilon
  );
}

function addUniquePoint(points, point, epsilon) {
  if (
    points.some(
      (candidate) => length(subtract(candidate, point)) <= epsilon,
    )
  ) {
    return;
  }
  points.push(point);
}

function trianglePlaneIntersectionPoints(
  triangle,
  planePoint,
  planeNormal,
  epsilon,
) {
  const distances = triangle.vertices.map((vertex) =>
    dot(planeNormal, subtract(vertex, planePoint)),
  );
  const points = [];

  for (let index = 0; index < triangle.vertices.length; index += 1) {
    if (Math.abs(distances[index]) <= epsilon) {
      addUniquePoint(points, triangle.vertices[index], epsilon);
    }
  }

  for (let index = 0; index < triangle.vertices.length; index += 1) {
    const next = (index + 1) % triangle.vertices.length;
    const leftDistance = distances[index];
    const rightDistance = distances[next];
    if (
      (leftDistance < -epsilon && rightDistance > epsilon) ||
      (leftDistance > epsilon && rightDistance < -epsilon)
    ) {
      const ratio = leftDistance / (leftDistance - rightDistance);
      const left = triangle.vertices[index];
      const right = triangle.vertices[next];
      addUniquePoint(
        points,
        [
          left[0] + (right[0] - left[0]) * ratio,
          left[1] + (right[1] - left[1]) * ratio,
          left[2] + (right[2] - left[2]) * ratio,
        ],
        epsilon,
      );
    }
  }

  return points;
}

function projectionInterval(points, axis) {
  const values = points.map((point) => dot(point, axis));
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

function nonCoplanarIntersectionBeyondSharedVertex(
  left,
  right,
  sharedIndex,
  epsilon,
) {
  const lineDirection = normalize(cross(left.normal, right.normal));
  if (!lineDirection) return true;

  const leftPoints = trianglePlaneIntersectionPoints(
    left,
    right.vertices[0],
    right.normal,
    epsilon,
  );
  const rightPoints = trianglePlaneIntersectionPoints(
    right,
    left.vertices[0],
    left.normal,
    epsilon,
  );
  if (leftPoints.length === 0 || rightPoints.length === 0) return true;

  const leftInterval = projectionInterval(leftPoints, lineDirection);
  const rightInterval = projectionInterval(rightPoints, lineDirection);
  const overlapMinimum = Math.max(
    leftInterval.minimum,
    rightInterval.minimum,
  );
  const overlapMaximum = Math.min(
    leftInterval.maximum,
    rightInterval.maximum,
  );

  if (overlapMaximum - overlapMinimum > epsilon) return true;

  const sharedPoint = pointForIndex(left, sharedIndex);
  if (!sharedPoint) return true;
  const sharedProjection = dot(sharedPoint, lineDirection);
  const contactProjection = (overlapMinimum + overlapMaximum) * 0.5;
  return Math.abs(contactProjection - sharedProjection) > epsilon;
}

function dominantAxis(normal) {
  const absolute = normal.map(Math.abs);
  if (absolute[0] >= absolute[1] && absolute[0] >= absolute[2]) return 0;
  return absolute[1] >= absolute[2] ? 1 : 2;
}

function projectPoint(point, droppedAxis) {
  if (droppedAxis === 0) return [point[1], point[2]];
  if (droppedAxis === 1) return [point[0], point[2]];
  return [point[0], point[1]];
}

function orient(left, middle, right) {
  return (
    (middle[0] - left[0]) * (right[1] - left[1]) -
    (middle[1] - left[1]) * (right[0] - left[0])
  );
}

function pointStrictlyInsideTriangle(point, triangle, epsilon) {
  const orientations = [
    orient(triangle[0], triangle[1], point),
    orient(triangle[1], triangle[2], point),
    orient(triangle[2], triangle[0], point),
  ];
  const hasPositive = orientations.some((value) => value > epsilon);
  const hasNegative = orientations.some((value) => value < -epsilon);
  const onBoundary = orientations.some((value) => Math.abs(value) <= epsilon);
  return !hasPositive || !hasNegative
    ? !onBoundary && !(hasPositive && hasNegative)
    : false;
}

function onSegment(point, start, end, epsilon) {
  if (Math.abs(orient(start, end, point)) > epsilon) return false;
  return (
    point[0] >= Math.min(start[0], end[0]) - epsilon &&
    point[0] <= Math.max(start[0], end[0]) + epsilon &&
    point[1] >= Math.min(start[1], end[1]) - epsilon &&
    point[1] <= Math.max(start[1], end[1]) + epsilon
  );
}

function edgeRecords(triangle, projected) {
  return projected.map((start, index) => {
    const next = (index + 1) % projected.length;
    return {
      start,
      end: projected[next],
      startIndex: triangle.vertexIndices[index],
      endIndex: triangle.vertexIndices[next],
    };
  });
}

function sameIndexedEdge(left, right) {
  return (
    (left.startIndex === right.startIndex && left.endIndex === right.endIndex) ||
    (left.startIndex === right.endIndex && left.endIndex === right.startIndex)
  );
}

function collinearOverlapLength(left, right) {
  const xExtent = Math.max(
    Math.abs(left.end[0] - left.start[0]),
    Math.abs(right.end[0] - right.start[0]),
  );
  const axis = xExtent >= Math.max(
    Math.abs(left.end[1] - left.start[1]),
    Math.abs(right.end[1] - right.start[1]),
  )
    ? 0
    : 1;
  const minimum = Math.max(
    Math.min(left.start[axis], left.end[axis]),
    Math.min(right.start[axis], right.end[axis]),
  );
  const maximum = Math.min(
    Math.max(left.start[axis], left.end[axis]),
    Math.max(right.start[axis], right.end[axis]),
  );
  return maximum - minimum;
}

function endpointContactIsShared(leftEdge, rightEdge, epsilon) {
  const contacts = [
    [leftEdge.start, leftEdge.startIndex, rightEdge],
    [leftEdge.end, leftEdge.endIndex, rightEdge],
    [rightEdge.start, rightEdge.startIndex, leftEdge],
    [rightEdge.end, rightEdge.endIndex, leftEdge],
  ];

  for (const [point, index, edge] of contacts) {
    if (!onSegment(point, edge.start, edge.end, epsilon)) continue;
    if (index === edge.startIndex || index === edge.endIndex) continue;
    return false;
  }

  return true;
}

function edgesIntersectBeyondSharedTopology(left, right, epsilon) {
  if (sameIndexedEdge(left, right)) return false;

  const leftStart = orient(left.start, left.end, right.start);
  const leftEnd = orient(left.start, left.end, right.end);
  const rightStart = orient(right.start, right.end, left.start);
  const rightEnd = orient(right.start, right.end, left.end);

  const properIntersection =
    ((leftStart > epsilon && leftEnd < -epsilon) ||
      (leftStart < -epsilon && leftEnd > epsilon)) &&
    ((rightStart > epsilon && rightEnd < -epsilon) ||
      (rightStart < -epsilon && rightEnd > epsilon));
  if (properIntersection) return true;

  const collinear =
    Math.abs(leftStart) <= epsilon &&
    Math.abs(leftEnd) <= epsilon &&
    Math.abs(rightStart) <= epsilon &&
    Math.abs(rightEnd) <= epsilon;
  if (collinear) return collinearOverlapLength(left, right) > epsilon;

  const touches =
    onSegment(right.start, left.start, left.end, epsilon) ||
    onSegment(right.end, left.start, left.end, epsilon) ||
    onSegment(left.start, right.start, right.end, epsilon) ||
    onSegment(left.end, right.start, right.end, epsilon);
  return touches && !endpointContactIsShared(left, right, epsilon);
}

function coplanarIntersectionBeyondSharedTopology(
  left,
  right,
  sharedIndices,
  epsilon,
) {
  const droppedAxis = dominantAxis(left.normal);
  const leftProjected = left.vertices.map((point) =>
    projectPoint(point, droppedAxis),
  );
  const rightProjected = right.vertices.map((point) =>
    projectPoint(point, droppedAxis),
  );
  const sharedSet = new Set(sharedIndices);

  for (let index = 0; index < leftProjected.length; index += 1) {
    if (sharedSet.has(left.vertexIndices[index])) continue;
    if (pointStrictlyInsideTriangle(leftProjected[index], rightProjected, epsilon)) {
      return true;
    }
  }
  for (let index = 0; index < rightProjected.length; index += 1) {
    if (sharedSet.has(right.vertexIndices[index])) continue;
    if (pointStrictlyInsideTriangle(rightProjected[index], leftProjected, epsilon)) {
      return true;
    }
  }

  const leftEdges = edgeRecords(left, leftProjected);
  const rightEdges = edgeRecords(right, rightProjected);
  return leftEdges.some((leftEdge) =>
    rightEdges.some((rightEdge) =>
      edgesIntersectBeyondSharedTopology(leftEdge, rightEdge, epsilon),
    ),
  );
}

export function trianglesIntersectBeyondSharedTopology(
  left,
  right,
  epsilon,
) {
  if (!trianglesIntersect(left, right, epsilon)) return false;

  const sharedIndices = sharedVertexIndices(left, right);
  if (sharedIndices.length === 0) return true;
  if (sharedIndices.length === 3) return false;

  if (planesAreCoplanar(left, right, epsilon)) {
    return coplanarIntersectionBeyondSharedTopology(
      left,
      right,
      sharedIndices,
      epsilon,
    );
  }

  if (sharedIndices.length >= 2) return false;
  return nonCoplanarIntersectionBeyondSharedVertex(
    left,
    right,
    sharedIndices[0],
    epsilon,
  );
}
