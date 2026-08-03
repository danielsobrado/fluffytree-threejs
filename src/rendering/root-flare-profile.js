import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

const TAU = Math.PI * 2;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function interpolate(left, right, ratio) {
  return left + (right - left) * ratio;
}

export function getRootBaseHeight() {
  return -TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth;
}

export function getRootFlareTopHeight() {
  return TREE_STRUCTURE_RENDERING_CONSTANTS.rootFlareHeight;
}

export function calculateRootFlareRatio(height) {
  const base = getRootBaseHeight();
  const top = getRootFlareTopHeight();
  return clamp01((height - base) / (top - base));
}

export function calculateRootFlareScale(flare, height) {
  const widest =
    1 + flare * TREE_STRUCTURE_RENDERING_CONSTANTS.rootFlareStrength;
  return interpolate(
    widest,
    1,
    Math.pow(
      calculateRootFlareRatio(height),
      TREE_STRUCTURE_RENDERING_CONSTANTS.rootFlareExponent,
    ),
  );
}

export function calculateRootButtressScale(angle, height, seed, nebari = 1) {
  const ratio = calculateRootFlareRatio(height);
  const phase = (((Number(seed) >>> 0) % 997) / 997) * TAU;
  const wave = Math.max(
    0,
    Math.cos(
      angle * TREE_STRUCTURE_RENDERING_CONSTANTS.rootButtressCount + phase,
    ),
  );
  const groundWeight = Math.sin(
    Math.PI *
      Math.min(
        1,
        ratio * TREE_STRUCTURE_RENDERING_CONSTANTS.rootButtressGroundSpan,
      ),
  );
  return (
    1 +
    wave *
      wave *
      TREE_STRUCTURE_RENDERING_CONSTANTS.rootButtressStrength *
      nebari *
      groundWeight
  );
}

export function calculateRootRadiusScale(flare, angle, height, seed, nebari = 1) {
  return (
    calculateRootFlareScale(flare, height) *
    calculateRootButtressScale(angle, height, seed, nebari)
  );
}

export function extendPathBelowGround(path) {
  if (!Array.isArray(path) || path.length < 3) {
    throw new Error('A trunk path requires at least three points.');
  }

  const [first, second] = path;
  const span = second.y - first.y;

  if (!(span > 0)) {
    throw new Error('The trunk path must ascend from its base point.');
  }

  const baseHeight = getRootBaseHeight();
  const ratio = (first.y - baseHeight) / span;

  return [
    {
      x: first.x - (second.x - first.x) * ratio,
      y: baseHeight,
      z: first.z - (second.z - first.z) * ratio,
    },
    ...path.map((point) => ({ x: point.x, y: point.y, z: point.z })),
  ];
}
