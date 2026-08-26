const GOLDEN_ANGLE = 2.39996323;

export function createGoldenAngleDiskKernel(count) {
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new RangeError('Depth-of-field tap count must be a positive integer.');
  }

  return Object.freeze(
    Array.from({ length: count }, (_, index) => {
      const radius = Math.sqrt((index + 0.5) / count);
      const angle = index * GOLDEN_ANGLE;
      return Object.freeze([
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
      ]);
    }),
  );
}
