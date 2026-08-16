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

function includePoint(bounds, point) {
  bounds.minimum.x = Math.min(bounds.minimum.x, point.x);
  bounds.minimum.y = Math.min(bounds.minimum.y, point.y);
  bounds.minimum.z = Math.min(bounds.minimum.z, point.z);
  bounds.maximum.x = Math.max(bounds.maximum.x, point.x);
  bounds.maximum.y = Math.max(bounds.maximum.y, point.y);
  bounds.maximum.z = Math.max(bounds.maximum.z, point.z);
}

function rotatedBounds(sourceBounds, rotationY) {
  const bounds = {
    minimum: {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      z: Number.POSITIVE_INFINITY,
    },
    maximum: {
      x: Number.NEGATIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
      z: Number.NEGATIVE_INFINITY,
    },
  };

  for (const x of [sourceBounds.minimum.x, sourceBounds.maximum.x]) {
    for (const y of [sourceBounds.minimum.y, sourceBounds.maximum.y]) {
      for (const z of [sourceBounds.minimum.z, sourceBounds.maximum.z]) {
        includePoint(bounds, rotateAroundY({ x, y, z }, rotationY));
      }
    }
  }

  return bounds;
}

export function calculateTreeIrImpostorLayout(
  treeIr,
  rotationY = 0,
  { textureSize = 128, paddingRatio = 0.08 } = {},
) {
  if (!treeIr?.bounds?.minimum || !treeIr?.bounds?.maximum) {
    throw new TypeError('Tree IR impostor layout requires tree bounds.');
  }
  if (paddingRatio < 0 || paddingRatio >= 0.5) {
    throw new RangeError(`Invalid impostor padding ratio '${paddingRatio}'.`);
  }

  const bounds = rotatedBounds(treeIr.bounds, rotationY);
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
