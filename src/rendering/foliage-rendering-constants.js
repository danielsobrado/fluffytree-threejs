export const FOLIAGE_RENDERING_CONSTANTS = Object.freeze({
  paletteTextureResolution: 64,
  alphaTextureResolution: 64,
  coreLobeDetail: 2,
  coreLobeDeformation: 0.055,
  coreRoughness: 0.96,
  shellRoughness: 0.92,
  shellPlaneTilt: 0.56,
  shellHeightScale: 1.15,
  shadowLobeDetail: 1,
  minimumSunFactor: 0.58,
  maximumSunFactor: 1.04,
  skyHighlightRatio: 0.25,
});

export const FOLIAGE_ALPHA_SHAPES = Object.freeze([
  Object.freeze({ x: -0.24, y: -0.02, radiusX: 0.34, radiusY: 0.24, angle: -0.35 }),
  Object.freeze({ x: 0.24, y: 0.02, radiusX: 0.34, radiusY: 0.24, angle: 0.35 }),
  Object.freeze({ x: 0, y: 0.23, radiusX: 0.27, radiusY: 0.36, angle: 0 }),
  Object.freeze({ x: 0, y: -0.23, radiusX: 0.29, radiusY: 0.34, angle: 0 }),
  Object.freeze({ x: -0.18, y: 0.22, radiusX: 0.25, radiusY: 0.22, angle: 0.45 }),
  Object.freeze({ x: 0.18, y: -0.2, radiusX: 0.25, radiusY: 0.22, angle: -0.45 }),
]);
