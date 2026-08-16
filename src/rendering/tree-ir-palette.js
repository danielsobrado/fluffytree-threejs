import * as THREE from 'three';

const SCRATCH_COLOR = new THREE.Color();

export function setTreeIrPaletteColor(target, palette, mix) {
  if (!Array.isArray(palette) || palette.length === 0) {
    return target.set('#ffffff');
  }
  if (palette.length === 1) return target.set(palette[0]);
  const scaled = Math.min(1, Math.max(0, mix)) * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  const ratio = scaled - index;
  SCRATCH_COLOR.set(palette[index + 1]);
  return target.set(palette[index]).lerp(SCRATCH_COLOR, ratio);
}
