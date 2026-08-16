const VECTOR_EPSILON = 1e-9;
const UP = Object.freeze({ x: 0, y: 1, z: 0 });
const RIGHT = Object.freeze({ x: 1, y: 0, z: 0 });

function copyVector(vector) {
  return { x: Number(vector.x), y: Number(vector.y), z: Number(vector.z) };
}

function normalize(vector, fallback) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= VECTOR_EPSILON) return copyVector(fallback);
  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

function cross(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

export function directionBetween(start, end) {
  return normalize(
    {
      x: end.x - start.x,
      y: end.y - start.y,
      z: end.z - start.z,
    },
    UP,
  );
}

export function createTreeIrFrame(position, direction) {
  const tangent = normalize(direction, UP);
  const reference = Math.abs(tangent.y) < 0.9 ? UP : RIGHT;
  const normal = normalize(cross(reference, tangent), RIGHT);
  const binormal = normalize(cross(tangent, normal), UP);

  return Object.freeze({
    position: Object.freeze(copyVector(position)),
    tangent: Object.freeze(tangent),
    normal: Object.freeze(normal),
    binormal: Object.freeze(binormal),
  });
}

export function createPathAttachmentFrame(path, index = 0) {
  if (!Array.isArray(path) || path.length < 2) {
    throw new Error('A Tree IR stem path requires at least two points.');
  }
  const clampedIndex = Math.min(Math.max(0, index), path.length - 2);
  return createTreeIrFrame(
    path[clampedIndex],
    directionBetween(path[clampedIndex], path[clampedIndex + 1]),
  );
}
