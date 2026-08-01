export const FOLIAGE_RENDERING_CONSTANTS = Object.freeze({
  paletteTextureResolution: 64,
  alphaTextureResolution: 64,
  coreLobeDetail: 3,
  coreLobeDeformation: 0.085,
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
  Object.freeze({ x: 0, y: -0.34, radiusX: 0.1, radiusY: 0.17, angle: 0 }),
  Object.freeze({ x: -0.19, y: -0.16, radiusX: 0.11, radiusY: 0.2, angle: -0.58 }),
  Object.freeze({ x: 0.19, y: -0.11, radiusX: 0.11, radiusY: 0.2, angle: 0.58 }),
  Object.freeze({ x: -0.17, y: 0.13, radiusX: 0.1, radiusY: 0.19, angle: -0.42 }),
  Object.freeze({ x: 0.18, y: 0.18, radiusX: 0.1, radiusY: 0.19, angle: 0.42 }),
  Object.freeze({ x: 0, y: 0.37, radiusX: 0.09, radiusY: 0.19, angle: 0 }),
]);
