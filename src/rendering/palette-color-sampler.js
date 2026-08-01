import * as THREE from 'three';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function samplePaletteColor(palette, coordinate) {
  if (!Array.isArray(palette) || palette.length === 0) {
    throw new Error('A foliage palette requires at least one color.');
  }

  if (palette.length === 1) {
    return new THREE.Color(palette[0]);
  }

  const scaled = clamp01(coordinate) * (palette.length - 1);
  const lowerIndex = Math.floor(scaled);
  const upperIndex = Math.min(palette.length - 1, lowerIndex + 1);
  return new THREE.Color(palette[lowerIndex]).lerp(
    new THREE.Color(palette[upperIndex]),
    scaled - lowerIndex,
  );
}
