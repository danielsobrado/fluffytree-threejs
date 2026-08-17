const HORIZONTAL_EPSILON = 1e-12;

export function calculateTreeWorldYaw(forward, fallbackYaw = 0) {
  if (
    !forward ||
    !Number.isFinite(forward.x) ||
    !Number.isFinite(forward.z) ||
    !Number.isFinite(fallbackYaw)
  ) {
    throw new TypeError('Tree world yaw requires finite forward and fallback values.');
  }

  if (Math.hypot(forward.x, forward.z) <= HORIZONTAL_EPSILON) {
    return fallbackYaw;
  }
  return Math.atan2(forward.x, forward.z);
}
