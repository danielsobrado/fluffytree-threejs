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

export function rotateVectorEuler(vector, rotation = { x: 0, y: 0, z: 0 }) {
  const cosX = Math.cos(rotation.x);
  const sinX = Math.sin(rotation.x);
  const cosY = Math.cos(rotation.y);
  const sinY = Math.sin(rotation.y);
  const cosZ = Math.cos(rotation.z);
  const sinZ = Math.sin(rotation.z);

  const xAfterX = vector.x;
  const yAfterX = vector.y * cosX - vector.z * sinX;
  const zAfterX = vector.y * sinX + vector.z * cosX;
  const xAfterY = xAfterX * cosY + zAfterX * sinY;
  const yAfterY = yAfterX;
  const zAfterY = -xAfterX * sinY + zAfterX * cosY;

  return {
    x: xAfterY * cosZ - yAfterY * sinZ,
    y: xAfterY * sinZ + yAfterY * cosZ,
    z: zAfterY,
  };
}

export function inverseRotateVectorEuler(
  vector,
  rotation = { x: 0, y: 0, z: 0 },
) {
  const inverse = {
    x: -rotation.x,
    y: -rotation.y,
    z: -rotation.z,
  };
  const cosX = Math.cos(inverse.x);
  const sinX = Math.sin(inverse.x);
  const cosY = Math.cos(inverse.y);
  const sinY = Math.sin(inverse.y);
  const cosZ = Math.cos(inverse.z);
  const sinZ = Math.sin(inverse.z);

  const xAfterZ = vector.x * cosZ - vector.y * sinZ;
  const yAfterZ = vector.x * sinZ + vector.y * cosZ;
  const zAfterZ = vector.z;
  const xAfterY = xAfterZ * cosY + zAfterZ * sinY;
  const yAfterY = yAfterZ;
  const zAfterY = -xAfterZ * sinY + zAfterZ * cosY;

  return {
    x: xAfterY,
    y: yAfterY * cosX - zAfterY * sinX,
    z: yAfterY * sinX + zAfterY * cosX,
  };
}

export function pointOnLobeSurface(lobe, direction) {
  const unit = normalizeVector(direction);
  const localPoint = {
    x: unit.x * lobe.scale.x,
    y: unit.y * lobe.scale.y,
    z: unit.z * lobe.scale.z,
  };
  const rotatedPoint = rotateVectorEuler(localPoint, lobe.rotation);

  return {
    x: lobe.position.x + rotatedPoint.x,
    y: lobe.position.y + rotatedPoint.y,
    z: lobe.position.z + rotatedPoint.z,
  };
}

export function lobeSurfaceNormal(lobe, direction) {
  const unit = normalizeVector(direction);
  const localNormal = {
    x: unit.x / lobe.scale.x,
    y: unit.y / lobe.scale.y,
    z: unit.z / lobe.scale.z,
  };

  return normalizeVector(rotateVectorEuler(localNormal, lobe.rotation));
}

export function normalizedRotatedPointDistance(point, lobe) {
  const localPoint = inverseRotateVectorEuler(
    {
      x: point.x - lobe.position.x,
      y: point.y - lobe.position.y,
      z: point.z - lobe.position.z,
    },
    lobe.rotation,
  );

  return Math.sqrt(
    (localPoint.x / lobe.scale.x) ** 2 +
      (localPoint.y / lobe.scale.y) ** 2 +
      (localPoint.z / lobe.scale.z) ** 2,
  );
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
