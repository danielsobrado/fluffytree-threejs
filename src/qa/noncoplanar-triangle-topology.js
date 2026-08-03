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
  return vector.map((value) => value / magnitude);
}

function pointForIndex(triangle, index) {
  const localIndex = triangle.vertexIndices.indexOf(index);
  return localIndex < 0 ? null : triangle.vertices[localIndex];
}

function addUniquePoint(points, point, epsilon) {
  if (
    points.some(
      (candidate) => vectorLength(subtract(candidate, point)) <= epsilon,
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
    const crossesPlane =
      (leftDistance < -epsilon && rightDistance > epsilon) ||
      (leftDistance > epsilon && rightDistance < -epsilon);
    if (!crossesPlane) continue;

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

  return points;
}

function projectionInterval(points, axis) {
  const values = points.map((point) => dot(point, axis));
  return {
    minimum: Math.min(...values),
    maximum: Math.max(...values),
  };
}

export function nonCoplanarTrianglesIntersectBeyondSharedVertex(
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
