const DEFAULT_SAMPLE_COUNT = 8;

function include(bounds, point) {
  bounds.minimum.x = Math.min(bounds.minimum.x, point.x);
  bounds.minimum.y = Math.min(bounds.minimum.y, point.y);
  bounds.minimum.z = Math.min(bounds.minimum.z, point.z);
  bounds.maximum.x = Math.max(bounds.maximum.x, point.x);
  bounds.maximum.y = Math.max(bounds.maximum.y, point.y);
  bounds.maximum.z = Math.max(bounds.maximum.z, point.z);
}

export function expandTreeIrFrondBounds(
  bounds,
  site,
  { sampleCount = DEFAULT_SAMPLE_COUNT } = {},
) {
  const frond = site?.metadata?.frond;
  if (!frond) return bounds;
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 1) {
    throw new RangeError('Tree IR frond bounds sampleCount must be a positive integer.');
  }

  const start = site.frame.position;
  const forwardX = Math.cos(frond.azimuth);
  const forwardZ = Math.sin(frond.azimuth);
  const sideX = -forwardZ;
  const sideZ = forwardX;

  for (let index = 0; index <= sampleCount; index += 1) {
    const t = index / sampleCount;
    const widthEnvelope = 0.08 + 0.92 * Math.sin(Math.PI * t) ** 0.65;
    const halfWidth = frond.width * widthEnvelope * 0.5;
    const horizontalDistance = frond.length * t;
    const verticalOffset =
      frond.length * (frond.rise * t - frond.droop * 0.68 * t * t);
    const center = {
      x: start.x + forwardX * horizontalDistance,
      y: start.y + verticalOffset,
      z: start.z + forwardZ * horizontalDistance,
    };
    include(bounds, {
      x: center.x - sideX * halfWidth,
      y: center.y,
      z: center.z - sideZ * halfWidth,
    });
    include(bounds, {
      x: center.x + sideX * halfWidth,
      y: center.y,
      z: center.z + sideZ * halfWidth,
    });
  }

  return bounds;
}
