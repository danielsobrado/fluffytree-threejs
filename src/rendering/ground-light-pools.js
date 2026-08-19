/**
 * The slow variation in a meadow's colour.
 *
 * A ground disc of one flat colour reads as a floor. What the reference frames
 * have instead is light pooling: broad patches where the grass is a shade paler
 * and warmer, and hollows where it is a shade cooler, at a scale of several
 * metres rather than of blades. It is not shadow and it is not texture, so
 * neither the shadow map nor a detail map produces it — it is baked into the
 * ground's own vertices, which costs one attribute and nothing per frame.
 *
 * The noise is value noise on a lattice, deterministic from a seed, so the same
 * scene is the same meadow every time it is opened. Two octaves is enough: the
 * point is broad pools, and a third octave at this amplitude is invisible under
 * the grass carpet standing in it.
 */

export const DEFAULT_GROUND_POOLS = Object.freeze({
  enabled: true,
  /** Metres per lattice cell. Pools are read at a stroll, not at a glance. */
  cellSize: 9,
  /** Peak lightness swing, as a fraction. */
  amplitude: 0.06,
  /** How far the lit patches drift toward yellow rather than just brightening. */
  warmth: 0.55,
  seed: 3607,
});

export function resolveGroundPoolSettings(config = {}) {
  const settings = { ...DEFAULT_GROUND_POOLS, ...config };

  settings.enabled = config.enabled !== false;
  settings.cellSize = Math.max(0.001, settings.cellSize);
  settings.amplitude = Math.max(0, settings.amplitude);
  settings.warmth = Math.min(Math.max(settings.warmth, 0), 1);

  return settings;
}

function hash(x, z, seed) {
  // Integer mixing rather than a sin-based hash: sin hashes band visibly at
  // the low frequencies this noise is sampled at.
  let value = (x * 374761393 + z * 668265263 + seed * 1442695040) | 0;
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function smooth(ratio) {
  return ratio * ratio * (3 - 2 * ratio);
}

function valueNoise(x, z, seed) {
  const cellX = Math.floor(x);
  const cellZ = Math.floor(z);
  const fractionX = smooth(x - cellX);
  const fractionZ = smooth(z - cellZ);

  const topLeft = hash(cellX, cellZ, seed);
  const topRight = hash(cellX + 1, cellZ, seed);
  const bottomLeft = hash(cellX, cellZ + 1, seed);
  const bottomRight = hash(cellX + 1, cellZ + 1, seed);

  return (
    (topLeft + (topRight - topLeft) * fractionX) * (1 - fractionZ) +
    (bottomLeft + (bottomRight - bottomLeft) * fractionX) * fractionZ
  );
}

/**
 * How much lighter or darker the ground is at this point, from -1 to 1, and
 * how far toward the warm end of the palette it leans.
 */
export function sampleGroundPool(x, z, settings) {
  const scale = 1 / settings.cellSize;
  const broad = valueNoise(x * scale, z * scale, settings.seed);
  const fine = valueNoise(x * scale * 2.7, z * scale * 2.7, settings.seed + 101);
  const level = (broad * 0.72 + fine * 0.28) * 2 - 1;

  return {
    level,
    // Only the lit side warms. A hollow going cool and blue is the sky filling
    // it, which the shading already does; warming it as well would be double.
    warmth: Math.max(level, 0) * settings.warmth,
  };
}

/**
 * The ground colour at a point, given the flat colour the scene configured.
 *
 * Colours come in and go out as `{ r, g, b }` in 0..1, so this stays free of
 * the renderer and can be checked without one.
 */
export function applyGroundPool(base, x, z, settings) {
  if (!settings.enabled) return { ...base };

  const { level, warmth } = sampleGroundPool(x, z, settings);
  const lift = 1 + level * settings.amplitude;

  return {
    r: clampChannel(base.r * lift * (1 + warmth * 0.16)),
    g: clampChannel(base.g * lift * (1 + warmth * 0.07)),
    b: clampChannel(base.b * lift * (1 - warmth * 0.12)),
  };
}

function clampChannel(value) {
  return Math.min(Math.max(value, 0), 1);
}
