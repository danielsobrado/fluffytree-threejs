import { LEAF_DETAIL_RENDERING_CONSTANTS } from './leaf-detail-rendering-constants.js';

function lerp(start, end, ratio) {
  return start + (end - start) * ratio;
}

function calculateLayerRatio(layer, layerCount) {
  return layerCount <= 1 ? 0.5 : layer / (layerCount - 1);
}

function calculateRadialLayerRatio(layer, layerCount) {
  return layerCount <= 1 ? 1 : layer / (layerCount - 1);
}

export function getInnerInsetRatio(settings) {
  return (
    settings.layerOffsetRatio *
    LEAF_DETAIL_RENDERING_CONSTANTS.innerInsetMultiplier
  );
}

export function getOuterOffsetRatio(settings) {
  return (
    settings.layerOffsetRatio *
    LEAF_DETAIL_RENDERING_CONSTANTS.outerOffsetMultiplier
  );
}

export function getTangentialJitterRatio(settings) {
  return (
    settings.layerOffsetRatio *
    LEAF_DETAIL_RENDERING_CONSTANTS.tangentialJitterMultiplier
  );
}

export function calculateSurfaceLayerScale(layer, settings) {
  return lerp(
    LEAF_DETAIL_RENDERING_CONSTANTS.innerLayerScale,
    LEAF_DETAIL_RENDERING_CONSTANTS.outerLayerScale,
    calculateLayerRatio(layer, settings.layerCount),
  );
}

export function calculateSurfaceRadialOffset(layer, settings, instanceScale) {
  const offsetRatio = lerp(
    -getInnerInsetRatio(settings),
    getOuterOffsetRatio(settings),
    calculateRadialLayerRatio(layer, settings.layerCount),
  );
  return offsetRatio * instanceScale;
}
