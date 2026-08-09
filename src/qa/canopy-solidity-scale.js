export function calculateTransitionHoleThresholds({
  minimumHolePixels,
  minimumHoleRadius,
  probeProjectedPixels,
  targetProjectedPixels,
}) {
  const target = Number(targetProjectedPixels);
  const probe = Number(probeProjectedPixels);
  const scale =
    Number.isFinite(target) && target > 0 && Number.isFinite(probe) && probe > target
      ? probe / target
      : 1;

  return Object.freeze({
    scale,
    minimumHolePixels: Math.ceil(minimumHolePixels * scale * scale),
    minimumHoleRadius: Math.ceil(minimumHoleRadius * scale),
  });
}
