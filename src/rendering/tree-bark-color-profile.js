import {
  PALM_BARK_STYLE,
  TREE_BARK_PATTERNS,
} from './tree-bark-style-constants.js?v=2.0.0-20260814.2';

const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function woodMix(u, v, phase, order) {
  const grain = Math.sin(v * 31 + Math.sin(u * TAU * 3 + phase) * 1.8 + phase);
  const broad = Math.sin(v * 7.5 + u * TAU + phase * 0.6);
  const ridge = clamp01(0.5 + grain * 0.16 + broad * 0.12 + order * 0.035);
  return clamp01(ridge - Math.pow(1 - clamp01(v), 3) * 0.22);
}

function palmMix(u, v, phase, treeHeight) {
  const bandCount = Math.min(
    PALM_BARK_STYLE.maximumBandCount,
    Math.max(
      PALM_BARK_STYLE.minimumBandCount,
      treeHeight * PALM_BARK_STYLE.bandsPerMeter,
    ),
  );
  const azimuthWarp =
    Math.sin(u * TAU * 2 + phase) * PALM_BARK_STYLE.azimuthWarpStrength;
  const rings = Math.sin(v * TAU * bandCount + azimuthWarp + phase * 0.35);
  const verticalBreakup = Math.sin(u * TAU * 5 + v * 8 + phase * 0.7);
  const base =
    0.5 +
    rings * PALM_BARK_STYLE.ringStrength +
    verticalBreakup * PALM_BARK_STYLE.verticalBreakupStrength;
  return clamp01(
    base -
      Math.pow(1 - clamp01(v), 2) * PALM_BARK_STYLE.baseDarkening,
  );
}

export function calculateTreeBarkColorMix({
  u,
  v,
  phase,
  order = 0,
  treeHeight = 1,
  pattern = TREE_BARK_PATTERNS.WOOD,
}) {
  if (pattern === TREE_BARK_PATTERNS.PALM) {
    return palmMix(u, v, phase, treeHeight);
  }
  return woodMix(u, v, phase, order);
}
