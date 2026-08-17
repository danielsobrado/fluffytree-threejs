const FROND_DROOP_CURVE = 0.68;
const HALF = 0.5;
const QUADRATIC_EPSILON = 1e-12;

function includeHorizontalEnvelope(bounds, start, frond) {
  const forwardX = Math.cos(frond.azimuth);
  const forwardZ = Math.sin(frond.azimuth);
  const sideX = -forwardZ;
  const sideZ = forwardX;
  const endX = start.x + forwardX * frond.length;
  const endZ = start.z + forwardZ * frond.length;
  const halfWidth = Math.abs(frond.width) * HALF;
  const extentX = Math.abs(sideX) * halfWidth;
  const extentZ = Math.abs(sideZ) * halfWidth;

  bounds.minimum.x = Math.min(
    bounds.minimum.x,
    Math.min(start.x, endX) - extentX,
  );
  bounds.maximum.x = Math.max(
    bounds.maximum.x,
    Math.max(start.x, endX) + extentX,
  );
  bounds.minimum.z = Math.min(
    bounds.minimum.z,
    Math.min(start.z, endZ) - extentZ,
  );
  bounds.maximum.z = Math.max(
    bounds.maximum.z,
    Math.max(start.z, endZ) + extentZ,
  );
}

function verticalOffset(frond, ratio) {
  return (
    frond.length *
    (frond.rise * ratio -
      frond.droop * FROND_DROOP_CURVE * ratio * ratio)
  );
}

function includeVerticalEnvelope(bounds, start, frond) {
  const ratios = [0, 1];
  const quadratic = frond.droop * FROND_DROOP_CURVE;

  if (Math.abs(quadratic) > QUADRATIC_EPSILON) {
    const stationaryRatio = frond.rise / (2 * quadratic);
    if (stationaryRatio > 0 && stationaryRatio < 1) {
      ratios.push(stationaryRatio);
    }
  }

  for (const ratio of ratios) {
    const y = start.y + verticalOffset(frond, ratio);
    bounds.minimum.y = Math.min(bounds.minimum.y, y);
    bounds.maximum.y = Math.max(bounds.maximum.y, y);
  }
}

export function expandTreeIrFrondBounds(bounds, site) {
  const frond = site?.metadata?.frond;
  if (!frond) return bounds;

  const start = site.frame.position;
  includeHorizontalEnvelope(bounds, start, frond);
  includeVerticalEnvelope(bounds, start, frond);
  return bounds;
}
