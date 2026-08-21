import { trianglesIntersect } from './triangle-intersection-test.js?v=2.0.0-20260814.2';
import { coplanarTrianglesIntersectBeyondSharedTopology } from './coplanar-triangle-topology.js?v=2.0.0-20260814.2';
import { nonCoplanarTrianglesIntersectBeyondSharedVertex } from './noncoplanar-triangle-topology.js?v=2.0.0-20260814.2';

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

function sharedVertexIndices(left, right) {
  const rightIndices = new Set(right.vertexIndices);
  return left.vertexIndices.filter((index) => rightIndices.has(index));
}

function planesAreCoplanar(left, right, epsilon) {
  if (vectorLength(cross(left.normal, right.normal)) > 1e-8) return false;
  return (
    Math.abs(
      dot(
        left.normal,
        subtract(right.vertices[0], left.vertices[0]),
      ),
    ) <= epsilon
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
    return coplanarTrianglesIntersectBeyondSharedTopology(
      left,
      right,
      sharedIndices,
      epsilon,
    );
  }

  if (sharedIndices.length >= 2) return false;
  return nonCoplanarTrianglesIntersectBeyondSharedVertex(
    left,
    right,
    sharedIndices[0],
    epsilon,
  );
}
