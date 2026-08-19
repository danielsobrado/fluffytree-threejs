const VECTOR_EPSILON = 1e-9;
const UP = Object.freeze({ x: 0, y: 1, z: 0 });
const RIGHT = Object.freeze({ x: 1, y: 0, z: 0 });

function canonicalNumber(value) {
  const number = Number(value);
  return Object.is(number, -0) ? 0 : number;
}

function copyVector(vector) {
  return {
    x: canonicalNumber(vector.x),
    y: canonicalNumber(vector.y),
    z: canonicalNumber(vector.z),
  };
}

function normalize(vector, fallback) {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= VECTOR_EPSILON) return copyVector(fallback);
  return {
    x: canonicalNumber(vector.x / length),
    y: canonicalNumber(vector.y / length),
    z: canonicalNumber(vector.z / length),
  };
}

function cross(left, right) {
  return {
    x: canonicalNumber(left.y * right.z - left.z * right.y),
    y: canonicalNumber(left.z * right.x - left.x * right.z),
    z: canonicalNumber(left.x * right.y - left.y * right.x),
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
