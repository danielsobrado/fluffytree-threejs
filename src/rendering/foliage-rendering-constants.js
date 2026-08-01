export const FOLIAGE_RENDERING_CONSTANTS = Object.freeze({
  paletteTextureResolution: 64,
  alphaTextureResolution: 64,
  coreLobeDetail: 3,
  coreLobeDeformation: 0.035,
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
  Object.freeze({ x: 0, y: -0.32, radiusX: 0.22, radiusY: 0.2, angle: 0 }),
  Object.freeze({ x: -0.16, y: -0.12, radiusX: 0.24, radiusY: 0.2, angle: -0.42 }),
  Object.freeze({ x: 0.16, y: -0.08, radiusX: 0.24, radiusY: 0.2, angle: 0.42 }),
  Object.freeze({ x: -0.13, y: 0.13, radiusX: 0.21, radiusY: 0.23, angle: -0.28 }),
  Object.freeze({ x: 0.14, y: 0.17, radiusX: 0.21, radiusY: 0.23, angle: 0.28 }),
  Object.freeze({ x: 0, y: 0.35, radiusX: 0.18, radiusY: 0.25, angle: 0 }),
]);
