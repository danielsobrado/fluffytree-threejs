const EPSILON = 1e-9;

export function addVector(left, right) {
  return {
    x: left.x + right.x,
    y: left.y + right.y,
    z: left.z + right.z,
  };
}

export function subtractVector(left, right) {
  return {
    x: left.x - right.x,
    y: left.y - right.y,
    z: left.z - right.z,
  };
}

export function scaleVector(vector, scale) {
  return {
    x: vector.x * scale,
    y: vector.y * scale,
    z: vector.z * scale,
  };
}

export function vectorLength(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalizeVector3(vector, fallback = { x: 0, y: 1, z: 0 }) {
  const length = vectorLength(vector);
  if (length <= EPSILON) return { ...fallback };
  return scaleVector(vector, 1 / length);
}

export function crossVector(left, right) {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

export function distanceSquared(left, right) {
  const difference = subtractVector(left, right);
  return (
    difference.x * difference.x +
    difference.y * difference.y +
    difference.z * difference.z
  );
}

export function lerpVector(left, right, ratio) {
  return {
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio,
    z: left.z + (right.z - left.z) * ratio,
  };
}

export function createDirectionBasis(direction) {
  const tangent = normalizeVector3(direction);
  const reference = Math.abs(tangent.y) < 0.92
    ? { x: 0, y: 1, z: 0 }
    : { x: 1, y: 0, z: 0 };
  const normal = normalizeVector3(crossVector(reference, tangent), {
    x: 1,
    y: 0,
    z: 0,
  });
  const binormal = normalizeVector3(crossVector(tangent, normal));
  return { tangent, normal, binormal };
}

export function coneDirection(direction, angle, azimuth) {
  const basis = createDirectionBasis(direction);
  const radial = addVector(
    scaleVector(basis.normal, Math.cos(azimuth)),
    scaleVector(basis.binormal, Math.sin(azimuth)),
  );
  return normalizeVector3(
    addVector(
      scaleVector(basis.tangent, Math.cos(angle)),
      scaleVector(radial, Math.sin(angle)),
    ),
  );
}
