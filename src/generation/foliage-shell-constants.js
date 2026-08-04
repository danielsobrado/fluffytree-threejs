export const FOLIAGE_SHELL_CONSTANTS = Object.freeze({
  tau: Math.PI * 2,
  goldenAngle: Math.PI * (3 - Math.sqrt(5)),
  clearanceOffset: 0.08,
  clearanceRange: 0.6,
  outwardBias: 0.25,
  outwardRange: 1.25,
  exposureWeight: 0.58,
  outwardWeight: 0.34,
  upwardWeight: 0.08,
  scoreJitter: 0.0001,
  // A cluster only counts as covering a candidate when both face roughly the
  // same way, so a card on the far side of a thin crown cannot claim the near
  // side is covered. cos(75 degrees).
  minimumCoverageNormalDot: 0.2588,
  minimumCellSize: 1e-4,
  maximumCoverageSearchRings: 3,
  coverageRatioEpsilon: 1e-12,
  // A disk beyond half a quad width leaves the rendered geometry in cardinal
  // directions. Keep a small margin for floating-point and raster boundaries.
  maximumPhysicalCoverageCardRatio: 0.49,
  // Presets without a continuity profile still avoid tiny randomized cards
  // dominating the packing density.
  defaultMaximumShellCardWidthSpread: 1.4,
  seedSalt: 0x9e3779b9,
});
