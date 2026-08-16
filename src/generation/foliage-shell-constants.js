const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const FOLIAGE_SHELL_CONSTANTS = Object.freeze({
  tau: Math.PI * 2,
  goldenAngle: GOLDEN_ANGLE,
  clearanceOffset: 0.08,
  clearanceRange: 0.6,
  outwardBias: 0.25,
  outwardRange: 1.25,
  exposureWeight: 0.58,
  outwardWeight: 0.34,
  upwardWeight: 0.08,
  scoreJitter: 0.0001,
  primaryCoverageStopRatio: 0.5,
  referenceOpaqueAreaRatio: 0.425,
  maximumSparseShapeRepairMultiplier: 1.5,
  minimumSparseShapeStopMultiplier: 0.78,
  coverageCertificationMinimumDirectionScale: 0.5,
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
  // Used when a caller constructs presets without loading the continuity file.
  maximumShellCardWidthSpreadByProfile: Object.freeze({
    round: 1.4,
    columnar: 2.5,
    vase: 2.6,
    pad: 2.5,
  }),
  defaultMaximumShellCardWidthSpread: 1.4,
  seedSalt: 0x9e3779b9,
});
