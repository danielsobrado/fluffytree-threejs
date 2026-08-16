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

export function calculateProjectedTreePixels(height, distance, focalPixels) {
  if (!Number.isFinite(height) || height <= 0) {
    throw new RangeError('Tree height must be positive.');
  }
  if (!Number.isFinite(distance) || distance <= 0) {
    throw new RangeError('Tree distance must be positive.');
  }
  if (!Number.isFinite(focalPixels) || focalPixels <= 0) {
    throw new RangeError('Camera focal pixels must be positive.');
  }
  return (height / distance) * focalPixels;
}
