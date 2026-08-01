import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';

export function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

export function interpolate(left, right, ratio) {
  return left + (right - left) * ratio;
}

export function interpolatePoint(left, right, ratio) {
  return {
    x: interpolate(left.x, right.x, ratio),
    y: interpolate(left.y, right.y, ratio),
    z: interpolate(left.z, right.z, ratio),
  };
}

export function distanceSquared(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

export function normalize(vector, fallback = { x: 0, y: 1, z: 0 }) {
  const magnitude = Math.hypot(vector.x, vector.y, vector.z);
  if (magnitude <= 1e-6) return { ...fallback };

  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude,
    z: vector.z / magnitude,
  };
}

export function hashUnit(seed, id, salt) {
  let value = (Number(seed) ^ Math.imul(id + 1, salt)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}

export function randomDirection(seed, id, upwardBias = 0) {
  const vertical = hashUnit(seed, id, 0x9e3779b1) * 2 - 1;
  const angle =
    hashUnit(seed, id, 0x85ebca6b) * CANOPY_CLOSURE_CONSTANTS.tau;
  const horizontal = Math.sqrt(Math.max(0, 1 - vertical * vertical));

  return normalize({
    x: Math.cos(angle) * horizontal,
    y: vertical + upwardBias,
    z: Math.sin(angle) * horizontal,
  });
}
