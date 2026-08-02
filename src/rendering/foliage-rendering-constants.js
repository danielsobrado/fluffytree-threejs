export const FOLIAGE_RENDERING_CONSTANTS = Object.freeze({
  paletteTextureResolution: 64,
  alphaTextureResolution: 64,
  coreLobeDetail: 3,
  coreLobeDeformation: 0.16,
  // The clump cores are the canopy's opaque interior. They are sized so that
  // neighbouring cores still overlap in the crevices between clumps, which is
  // where an alpha-cut shell alone leaves the sky visible through the crown.
  coreScaleMultiplier: 1.35,
  // Inward copies of exterior cards. They add parallax behind the canopy surface
  // but cannot fill a region the exterior pass never covered, so the triangle
  // budget goes to exterior coverage first and this layer takes what is left.
  heroInteriorDensity: 0.09,
  // Cluster quads are unit sized, so this is what turns a cluster's generated
  // scale into its rendered card width. The coverage gate needs the same number
  // to express a surface gap in card widths.
  shellCardScaleMultiplier: 2.55,
  coreRoughness: 0.96,
  shellRoughness: 0.92,
  shellRootInset: -0.08,
  shellTipWidth: 0.31,
  shadowLobeDetail: 1,
  minimumSunFactor: 0.64,
  maximumSunFactor: 1.02,
  skyHighlightRatio: 0.22,
});

export const FOLIAGE_ALPHA_SHAPES = Object.freeze([
  Object.freeze({ x: 0, y: -0.34, radiusX: 0.115, radiusY: 0.18, angle: 0 }),
  Object.freeze({ x: -0.18, y: -0.17, radiusX: 0.125, radiusY: 0.215, angle: -0.62 }),
  Object.freeze({ x: 0.18, y: -0.13, radiusX: 0.125, radiusY: 0.215, angle: 0.62 }),
  Object.freeze({ x: -0.19, y: 0.11, radiusX: 0.115, radiusY: 0.205, angle: -0.48 }),
  Object.freeze({ x: 0.19, y: 0.14, radiusX: 0.115, radiusY: 0.205, angle: 0.48 }),
  Object.freeze({ x: -0.08, y: 0.34, radiusX: 0.105, radiusY: 0.19, angle: -0.16 }),
  Object.freeze({ x: 0.12, y: 0.33, radiusX: 0.1, radiusY: 0.18, angle: 0.24 }),
]);
