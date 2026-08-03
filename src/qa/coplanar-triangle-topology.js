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

function maximumEdgeLength(...triangles) {
  let maximum = 0;

  for (const triangle of triangles) {
    for (let index = 0; index < triangle.length; index += 1) {
      const next = triangle[(index + 1) % triangle.length];
      maximum = Math.max(
        maximum,
        Math.hypot(
          next[0] - triangle[index][0],
          next[1] - triangle[index][1],
        ),
      );
    }
  }

  return maximum;
}

function pointStrictlyInsideTriangle(point, triangle, areaEpsilon) {
  const orientations = [
    orient(triangle[0], triangle[1], point),
    orient(triangle[1], triangle[2], point),
    orient(triangle[2], triangle[0], point),
  ];
  const hasPositive = orientations.some((value) => value > areaEpsilon);
  const hasNegative = orientations.some((value) => value < -areaEpsilon);
  const onBoundary = orientations.some(
    (value) => Math.abs(value) <= areaEpsilon,
  );
  return !onBoundary && !(hasPositive && hasNegative);
}

function onSegment(
  point,
  start,
  end,
  distanceEpsilon,
  areaEpsilon,
) {
  if (Math.abs(orient(start, end, point)) > areaEpsilon) return false;
  return (
    point[0] >= Math.min(start[0], end[0]) - distanceEpsilon &&
    point[0] <= Math.max(start[0], end[0]) + distanceEpsilon &&
    point[1] >= Math.min(start[1], end[1]) - distanceEpsilon &&
    point[1] <= Math.max(start[1], end[1]) + distanceEpsilon
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
  const yExtent = Math.max(
    Math.abs(left.end[1] - left.start[1]),
    Math.abs(right.end[1] - right.start[1]),
  );
  const axis = xExtent >= yExtent ? 0 : 1;
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

function endpointContactIsShared(
  leftEdge,
  rightEdge,
  distanceEpsilon,
  areaEpsilon,
) {
  const contacts = [
    [leftEdge.start, leftEdge.startIndex, rightEdge],
    [leftEdge.end, leftEdge.endIndex, rightEdge],
    [rightEdge.start, rightEdge.startIndex, leftEdge],
    [rightEdge.end, rightEdge.endIndex, leftEdge],
  ];

  for (const [point, index, edge] of contacts) {
    if (
      !onSegment(
        point,
        edge.start,
        edge.end,
        distanceEpsilon,
        areaEpsilon,
      )
    ) {
      continue;
    }
    if (index === edge.startIndex || index === edge.endIndex) continue;
    return false;
  }

  return true;
}

function edgesIntersectBeyondSharedTopology(
  left,
  right,
  distanceEpsilon,
  areaEpsilon,
) {
  if (sameIndexedEdge(left, right)) return false;

  const leftStart = orient(left.start, left.end, right.start);
  const leftEnd = orient(left.start, left.end, right.end);
  const rightStart = orient(right.start, right.end, left.start);
  const rightEnd = orient(right.start, right.end, left.end);
  const properIntersection =
    ((leftStart > areaEpsilon && leftEnd < -areaEpsilon) ||
      (leftStart < -areaEpsilon && leftEnd > areaEpsilon)) &&
    ((rightStart > areaEpsilon && rightEnd < -areaEpsilon) ||
      (rightStart < -areaEpsilon && rightEnd > areaEpsilon));
  if (properIntersection) return true;

  const collinear = [leftStart, leftEnd, rightStart, rightEnd].every(
    (value) => Math.abs(value) <= areaEpsilon,
  );
  if (collinear) {
    return collinearOverlapLength(left, right) > distanceEpsilon;
  }

  const touches =
    onSegment(
      right.start,
      left.start,
      left.end,
      distanceEpsilon,
      areaEpsilon,
    ) ||
    onSegment(
      right.end,
      left.start,
      left.end,
      distanceEpsilon,
      areaEpsilon,
    ) ||
    onSegment(
      left.start,
      right.start,
      right.end,
      distanceEpsilon,
      areaEpsilon,
    ) ||
    onSegment(
      left.end,
      right.start,
      right.end,
      distanceEpsilon,
      areaEpsilon,
    );
  return (
    touches &&
    !endpointContactIsShared(
      left,
      right,
      distanceEpsilon,
      areaEpsilon,
    )
  );
}

export function coplanarTrianglesIntersectBeyondSharedTopology(
  left,
  right,
  sharedIndices,
  distanceEpsilon,
) {
  const droppedAxis = dominantAxis(left.normal);
  const leftProjected = left.vertices.map((point) =>
    projectPoint(point, droppedAxis),
  );
  const rightProjected = right.vertices.map((point) =>
    projectPoint(point, droppedAxis),
  );
  const areaEpsilon = Math.max(
    distanceEpsilon * maximumEdgeLength(leftProjected, rightProjected),
    Number.EPSILON * 16,
  );
  const sharedSet = new Set(sharedIndices);

  for (let index = 0; index < leftProjected.length; index += 1) {
    if (sharedSet.has(left.vertexIndices[index])) continue;
    if (
      pointStrictlyInsideTriangle(
        leftProjected[index],
        rightProjected,
        areaEpsilon,
      )
    ) {
      return true;
    }
  }
  for (let index = 0; index < rightProjected.length; index += 1) {
    if (sharedSet.has(right.vertexIndices[index])) continue;
    if (
      pointStrictlyInsideTriangle(
        rightProjected[index],
        leftProjected,
        areaEpsilon,
      )
    ) {
      return true;
    }
  }

  const leftEdges = edgeRecords(left, leftProjected);
  const rightEdges = edgeRecords(right, rightProjected);
  return leftEdges.some((leftEdge) =>
    rightEdges.some((rightEdge) =>
      edgesIntersectBeyondSharedTopology(
        leftEdge,
        rightEdge,
        distanceEpsilon,
        areaEpsilon,
      ),
    ),
  );
}
