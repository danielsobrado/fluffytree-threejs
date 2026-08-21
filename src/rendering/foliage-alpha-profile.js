import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js?v=2.0.0-20260814.2';
import {
  DEFAULT_LEAF_SHAPE_ID,
  getLeafShape,
  sampleLeafAlpha,
} from './leaf-shape-library.js?v=2.0.0-20260814.2';

const PROFILE_CACHE = new Map();
const PIXEL_CACHE = new Map();
const CHANNEL_COUNT = 4;
const MAXIMUM_CARD_RADIUS = 0.49;

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function requireResolution(value) {
  const resolution = Number(value);
  if (!Number.isSafeInteger(resolution) || resolution < 2) {
    throw new RangeError('Foliage alpha resolution must be an integer of at least 2.');
  }
  return resolution;
}

function requireAlphaTest(value) {
  const alphaTest = Number(value);
  if (!Number.isFinite(alphaTest) || alphaTest < 0 || alphaTest > 1) {
    throw new RangeError('Foliage alphaTest must be within [0, 1].');
  }
  return alphaTest;
}

function requirePlaneCount(value) {
  const planeCount = Number(value);
  if (!Number.isSafeInteger(planeCount) || planeCount < 1) {
    throw new RangeError('Foliage planesPerCluster must be a positive integer.');
  }
  return planeCount;
}

function resolveShapeId(shapeId) {
  return shapeId === undefined ? DEFAULT_LEAF_SHAPE_ID : shapeId;
}

function createPixelTemplate(shapeId, resolution) {
  const resolvedShapeId = resolveShapeId(shapeId);
  const key = `${resolvedShapeId}:${resolution}`;
  const cached = PIXEL_CACHE.get(key);
  if (cached) return cached;

  const leafShape = getLeafShape(resolvedShapeId);
  const data = new Uint8Array(resolution * resolution * CHANNEL_COUNT);

  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      const normalizedX = (x + 0.5) / resolution - 0.5;
      const normalizedY = (y + 0.5) / resolution - 0.5;
      const alpha = Math.round(
        sampleLeafAlpha(normalizedX, normalizedY, leafShape) * 255,
      );
      const offset = (y * resolution + x) * CHANNEL_COUNT;
      data[offset] = alpha;
      data[offset + 1] = alpha;
      data[offset + 2] = alpha;
      data[offset + 3] = 255;
    }
  }

  PIXEL_CACHE.set(key, data);
  return data;
}

export function createFoliageAlphaPixels(
  shapeId,
  resolution = FOLIAGE_RENDERING_CONSTANTS.alphaTextureResolution,
) {
  const size = requireResolution(resolution);
  return createPixelTemplate(shapeId, size).slice();
}

function channel(data, resolution, x, y) {
  const clampedX = clamp(x, 0, resolution - 1);
  const clampedY = clamp(y, 0, resolution - 1);
  return data[(clampedY * resolution + clampedX) * CHANNEL_COUNT] / 255;
}

function sampleLinear(data, resolution, x, y) {
  if (Math.abs(x) > 0.5 || Math.abs(y) > 0.5) return 0;

  const textureX = (x + 0.5) * resolution - 0.5;
  const textureY = (y + 0.5) * resolution - 0.5;
  const x0 = Math.floor(textureX);
  const y0 = Math.floor(textureY);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const ratioX = textureX - x0;
  const ratioY = textureY - y0;
  const lower =
    channel(data, resolution, x0, y0) * (1 - ratioX) +
    channel(data, resolution, x1, y0) * ratioX;
  const upper =
    channel(data, resolution, x0, y1) * (1 - ratioX) +
    channel(data, resolution, x1, y1) * ratioX;

  return lower * (1 - ratioY) + upper * ratioY;
}

function calculateGuaranteedRadius(data, resolution, alphaTest) {
  if (alphaTest === 0) return MAXIMUM_CARD_RADIUS;

  let nearestRejectedTexel = Number.POSITIVE_INFINITY;
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (channel(data, resolution, x, y) >= alphaTest) continue;

      const normalizedX = (x + 0.5) / resolution - 0.5;
      const normalizedY = (y + 0.5) / resolution - 0.5;
      nearestRejectedTexel = Math.min(
        nearestRejectedTexel,
        Math.hypot(normalizedX, normalizedY),
      );
    }
  }

  if (!Number.isFinite(nearestRejectedTexel)) return MAXIMUM_CARD_RADIUS;

  const filterFootprint = Math.SQRT2 / resolution;
  return clamp(nearestRejectedTexel - filterFootprint, 0, MAXIMUM_CARD_RADIUS);
}

function calculateOpaqueAreaRatio(data, resolution, alphaTest) {
  if (alphaTest === 0) return 1;

  let opaqueTexelCount = 0;
  for (let y = 0; y < resolution; y += 1) {
    for (let x = 0; x < resolution; x += 1) {
      if (channel(data, resolution, x, y) >= alphaTest) opaqueTexelCount += 1;
    }
  }

  return opaqueTexelCount / (resolution * resolution);
}

export function createFoliageAlphaProfile({
  shapeId,
  alphaTest,
  planesPerCluster,
  resolution = FOLIAGE_RENDERING_CONSTANTS.alphaTextureResolution,
}) {
  const size = requireResolution(resolution);
  const threshold = requireAlphaTest(alphaTest);
  const planeCount = requirePlaneCount(planesPerCluster);
  const resolvedShapeId = resolveShapeId(shapeId);
  const key = `${resolvedShapeId}:${threshold}:${planeCount}:${size}`;
  const cached = PROFILE_CACHE.get(key);
  if (cached) return cached;

  const pixels = createPixelTemplate(resolvedShapeId, size);
  const profile = Object.freeze({
    shapeId: resolvedShapeId,
    alphaTest: threshold,
    planesPerCluster: planeCount,
    resolution: size,
    guaranteedRadiusRatio: calculateGuaranteedRadius(
      pixels,
      size,
      threshold,
    ),
    opaqueAreaRatio: calculateOpaqueAreaRatio(pixels, size, threshold),
    sample(x, y) {
      return sampleLinear(pixels, size, x, y);
    },
    isOpaque(x, y) {
      return sampleLinear(pixels, size, x, y) >= threshold;
    },
  });

  PROFILE_CACHE.set(key, profile);
  return profile;
}
