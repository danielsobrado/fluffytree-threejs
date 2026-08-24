export const TREE_WIND_PROFILE = Object.freeze({
  defaultStrength: 0.09,
  defaultSpeed: 0.72,
  shaderFallbackStrength: 0.055,
  primaryTimeScale: 0.78,
  secondaryTimeScale: 1.31,
  secondaryPhaseScale: 1.7,
  secondaryStrengthRatio: 0.46,
  maximumOscillationDelta: 2,
  seedModulo: 997,
  minimumTreeHeight: 1e-4,
  minimumInstanceScaleSquared: 1e-8,
});

export function calculateTreeWindBoundsPadding(strength) {
  return (
    Math.abs(Number(strength)) *
    TREE_WIND_PROFILE.maximumOscillationDelta *
    Math.hypot(1, TREE_WIND_PROFILE.secondaryStrengthRatio)
  );
}
