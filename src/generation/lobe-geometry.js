const EPSILON = 1e-9;

function vectorLength(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

export function normalizeVector(vector) {
  const length = vectorLength(vector);

  if (length <= EPSILON) {
    return { x: 0, y: 1, z: 0 };
  }

  return {
    x: vector.x / length,
    y: vector.y / length,
    z: vector.z / length,
  };
}

export function ellipsoidSupportRadius(scale, direction) {
  const unit = normalizeVector(direction);
  const denominator = Math.sqrt(
    (unit.x / scale.x) ** 2 +
      (unit.y / scale.y) ** 2 +
      (unit.z / scale.z) ** 2,
  );

  return denominator <= EPSILON ? 0 : 1 / denominator;
}

export function lobeOverlapRatio(left, right) {
  const separation = {
    x: right.position.x - left.position.x,
    y: right.position.y - left.position.y,
    z: right.position.z - left.position.z,
  };
  const distance = vectorLength(separation);

  if (distance <= EPSILON) {
    return 0;
  }

  const direction = normalizeVector(separation);
  const combinedRadius =
    ellipsoidSupportRadius(left.scale, direction) +
    ellipsoidSupportRadius(right.scale, {
      x: -direction.x,
      y: -direction.y,
      z: -direction.z,
    });

  return combinedRadius <= EPSILON
    ? Number.POSITIVE_INFINITY
    : distance / combinedRadius;
}

export function normalizedPointDistance(point, lobe) {
  return Math.sqrt(
    ((point.x - lobe.position.x) / lobe.scale.x) ** 2 +
      ((point.y - lobe.position.y) / lobe.scale.y) ** 2 +
      ((point.z - lobe.position.z) / lobe.scale.z) ** 2,
  );
}
