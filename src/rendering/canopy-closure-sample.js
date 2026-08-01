import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';
import { clamp, normalize } from './canopy-closure-math.js';

export function createClosureSample({
  id,
  position,
  normal,
  scale,
  colorMix,
  role,
}) {
  return Object.freeze({
    id,
    position: Object.freeze({ ...position }),
    normal: Object.freeze(normalize(normal)),
    scale: Math.max(CANOPY_CLOSURE_CONSTANTS.minimumScale, scale),
    colorMix: clamp(colorMix, 0, 1),
    rotation: id * CANOPY_CLOSURE_CONSTANTS.goldenAngle,
    role,
  });
}
