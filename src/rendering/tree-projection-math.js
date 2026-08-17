const DEGREES_TO_RADIANS = Math.PI / 180;

export function calculateCameraFocalPixels(fieldOfViewDegrees, viewportHeight) {
  if (
    !Number.isFinite(fieldOfViewDegrees) ||
    fieldOfViewDegrees <= 0 ||
    fieldOfViewDegrees >= 180
  ) {
    throw new RangeError('Camera field of view must be within (0, 180) degrees.');
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new RangeError('Viewport height must be positive.');
  }
  return (
    viewportHeight /
    (2 * Math.tan(fieldOfViewDegrees * DEGREES_TO_RADIANS * 0.5))
  );
}

export function resolveTreeWorldScale(scale) {
  if (
    !scale ||
    !Number.isFinite(scale.x) ||
    !Number.isFinite(scale.y) ||
    !Number.isFinite(scale.z)
  ) {
    throw new TypeError('Tree world scale must contain finite x, y, and z values.');
  }
  return Math.max(Math.abs(scale.x), Math.abs(scale.y), Math.abs(scale.z));
}

export function calculateProjectedTreePixels(
  height,
  distance,
  focalPixels,
  worldScale = 1,
) {
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError('Tree height must be positive.');
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    throw new RangeError('Tree distance must be positive.');
  }
  if (!Number.isFinite(focalPixels) || focalPixels <= 0) {
    throw new RangeError('Camera focal pixels must be positive.');
  }
  if (!Number.isFinite(worldScale) || worldScale < 0) {
    throw new RangeError('Tree world scale must be a finite non-negative number.');
  }
  return (height * worldScale * focalPixels) / distance;
}
