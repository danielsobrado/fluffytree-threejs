import * as THREE from 'three';

const COLOR_CACHE_LIMIT = 64;
const COLOR_CACHE = new Map();

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function resolveColor(value) {
  const cached = COLOR_CACHE.get(value);
  if (cached) return cached;

  const color = new THREE.Color(value);
  if (COLOR_CACHE.size >= COLOR_CACHE_LIMIT) {
    COLOR_CACHE.delete(COLOR_CACHE.keys().next().value);
  }
  COLOR_CACHE.set(value, color);
  return color;
}

export function samplePaletteColor(
  palette,
  coordinate,
  target = new THREE.Color(),
) {
  if (!Array.isArray(palette) || palette.length === 0) {
    throw new Error('A foliage palette requires at least one color.');
  }

  if (palette.length === 1) {
    return target.copy(resolveColor(palette[0]));
  }

  const scaled = clamp01(coordinate) * (palette.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(palette.length - 1, lowerIndex + 1);
  return target
    .copy(resolveColor(palette[lowerIndex]))
    .lerp(resolveColor(palette[upperIndex]), scaled - lowerIndex);
}
