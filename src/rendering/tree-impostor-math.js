const EPSILON = 1e-6;

function rotateAroundY(point, angle) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return {
    x: point.x * cosine + point.z * sine,
    y: point.y,
    z: -point.x * sine + point.z * cosine,
  };
}

function rotateEulerXyz(vector, rotation) {
  const x = Number(rotation?.x ?? 0);
  const y = Number(rotation?.y ?? 0);
  const z = Number(rotation?.z ?? 0);
  const a = Math.cos(x);
  const b = Math.sin(x);
  const c = Math.cos(y);
  const d = Math.sin(y);
  const e = Math.cos(z);
  const f = Math.sin(z);

  return {
    x: c * e * vector.x - c * f * vector.y + d * vector.z,
    y:
      (a * f + b * e * d) * vector.x +
      (a * e - b * f * d) * vector.y -
      b * c * vector.z,
    z:
      (b * f - a * e * d) * vector.x +
      (b * e + a * f * d) * vector.y +
      a * c * vector.z,
  };
}

function projectedBasis(lobe, rotationY) {
  return [
    { x: lobe.scale.x, y: 0, z: 0 },
    { x: 0, y: lobe.scale.y, z: 0 },
    { x: 0, y: 0, z: lobe.scale.z },
  ].map((basis) =>
    rotateAroundY(rotateEulerXyz(basis, lobe.rotation), rotationY),
  );
}

export function projectImpostorLobe(lobe, rotationY = 0) {
  const center = rotateAroundY(lobe.position, rotationY);
  const basis = projectedBasis(lobe, rotationY);
  const xx = basis.reduce((total, value) => total + value.x ** 2, 0);
  const xy = basis.reduce((total, value) => total + value.x * value.y, 0);
  const yy = basis.reduce((total, value) => total + value.y ** 2, 0);
  const zz = basis.reduce((total, value) => total + value.z ** 2, 0);
  const trace = xx + yy;
  const difference = Math.sqrt(Math.max(0, (xx - yy) ** 2 + 4 * xy ** 2));
  const major = Math.sqrt(Math.max(EPSILON, (trace + difference) * 0.5));
  const minor = Math.sqrt(Math.max(EPSILON, (trace - difference) * 0.5));

  return Object.freeze({
    center: Object.freeze(center),
    depth: center.z,
    radiusMajor: major,
    radiusMinor: minor,
    angle: 0.5 * Math.atan2(2 * xy, xx - yy),
    extentX: Math.sqrt(Math.max(EPSILON, xx)),
    extentY: Math.sqrt(Math.max(EPSILON, yy)),
    extentZ: Math.sqrt(Math.max(EPSILON, zz)),
  });
}

function createBounds() {
  return {
    minimum: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
    maximum: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
  };
}

function includePoint(bounds, point, radius = 0) {
  bounds.minimum.x = Math.min(bounds.minimum.x, point.x - radius);
  bounds.minimum.y = Math.min(bounds.minimum.y, point.y - radius);
  bounds.minimum.z = Math.min(bounds.minimum.z, point.z - radius);
  bounds.maximum.x = Math.max(bounds.maximum.x, point.x + radius);
  bounds.maximum.y = Math.max(bounds.maximum.y, point.y + radius);
  bounds.maximum.z = Math.max(bounds.maximum.z, point.z + radius);
}

function calculateProjectedBounds(treeData, rotationY) {
  const bounds = createBounds();
  const paths = [treeData.trunk, ...treeData.branches];

  for (const path of paths) {
    const radius = Math.max(Number(path.startRadius ?? 0), Number(path.endRadius ?? 0));
    for (const point of path.points) {
      includePoint(bounds, rotateAroundY(point, rotationY), radius);
    }
  }

  for (const lobe of treeData.lobes) {
    const projected = projectImpostorLobe(lobe, rotationY);
    bounds.minimum.x = Math.min(bounds.minimum.x, projected.center.x - projected.extentX);
    bounds.minimum.y = Math.min(bounds.minimum.y, projected.center.y - projected.extentY);
    bounds.minimum.z = Math.min(bounds.minimum.z, projected.center.z - projected.extentZ);
    bounds.maximum.x = Math.max(bounds.maximum.x, projected.center.x + projected.extentX);
    bounds.maximum.y = Math.max(bounds.maximum.y, projected.center.y + projected.extentY);
    bounds.maximum.z = Math.max(bounds.maximum.z, projected.center.z + projected.extentZ);
  }

  if (!Number.isFinite(bounds.minimum.x)) {
    includePoint(bounds, { x: 0, y: 0, z: 0 });
    includePoint(bounds, { x: 0, y: treeData.height, z: 0 });
  }

  return bounds;
}

export function calculateImpostorLayout(
  treeData,
  rotationY = 0,
  { textureSize = 128, paddingRatio = 0.08 } = {},
) {
  if (paddingRatio < 0 || paddingRatio >= 0.5) {
    throw new RangeError(`Invalid impostor padding ratio '${paddingRatio}'.`);
  }

  const bounds = calculateProjectedBounds(treeData, rotationY);
  const width = Math.max(EPSILON, bounds.maximum.x - bounds.minimum.x);
  const height = Math.max(EPSILON, bounds.maximum.y - bounds.minimum.y);
  const drawableSize = textureSize * (1 - paddingRatio * 2);
  const scale = drawableSize / Math.max(width, height);
  const offsetX = (textureSize - width * scale) * 0.5;
  const offsetY = (textureSize - height * scale) * 0.5;
  const viewCenter = {
    x: (bounds.minimum.x + bounds.maximum.x) * 0.5,
    y: (bounds.minimum.y + bounds.maximum.y) * 0.5,
    z: (bounds.minimum.z + bounds.maximum.z) * 0.5,
  };
  const anchor = rotateAroundY(viewCenter, -rotationY);

  return Object.freeze({
    bounds: Object.freeze({
      minimum: Object.freeze({ ...bounds.minimum }),
      maximum: Object.freeze({ ...bounds.maximum }),
    }),
    anchor: Object.freeze(anchor),
    width,
    height,
    worldSize: textureSize / scale,
    scale,
    point(value) {
      const projected = rotateAroundY(value, rotationY);
      return {
        x: (projected.x - bounds.minimum.x) * scale + offsetX,
        y: textureSize - ((projected.y - bounds.minimum.y) * scale + offsetY),
        depth: projected.z,
      };
    },
  });
}
