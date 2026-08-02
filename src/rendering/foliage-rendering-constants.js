export const FOLIAGE_RENDERING_CONSTANTS = Object.freeze({
  paletteTextureResolution: 64,
  alphaTextureResolution: 64,
  coreLobeDetail: 3,
  coreLobeDeformation: 0.16,
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
