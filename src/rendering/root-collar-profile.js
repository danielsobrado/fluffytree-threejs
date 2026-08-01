import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function interpolate(left, right, ratio) {
  return left + (right - left) * ratio;
}

export function getRootCollarMinimumHeight() {
  return -TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth;
}

export function getRootCollarJoinHeight() {
  return (
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight -
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarOverlap
  );
}

export function getRootCollarMaximumHeight() {
  return (
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight +
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarOverlap
  );
}

export function calculateRootCollarRadius(startRadius, flare, ratio) {
  const broadBase = startRadius * (1 + flare * 1.45);
  const collarTop = startRadius * (1 + flare * 0.12);
  return interpolate(broadBase, collarTop, Math.pow(clamp(ratio, 0, 1), 0.72));
}

export function calculateRootCollarRadiusAtHeight(startRadius, flare, height) {
  const minimumHeight = getRootCollarMinimumHeight();
  const maximumHeight = getRootCollarMaximumHeight();
  const ratio = (height - minimumHeight) / (maximumHeight - minimumHeight);
  return calculateRootCollarRadius(startRadius, flare, ratio);
}
