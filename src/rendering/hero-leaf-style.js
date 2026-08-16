import { hashUnit } from './deterministic-hash.js';

const HERO_SELECTION_SALT = 0x9e3779b1;
const HERO_STRETCH_X_SALT = 0x85ebca6b;
const HERO_STRETCH_Z_SALT = 0xc2b2ae35;
const HERO_LAYER_ID_STRIDE = 6151;
const HERO_MINIMUM_EXPOSURE_MULTIPLIER = 0.55;
const HERO_EXPOSURE_RANGE = 0.9;
const HERO_MINIMUM_CLUSTER_STRETCH = 0.92;
const HERO_CLUSTER_STRETCH_RANGE = 0.16;

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

export function calculateHeroLeafSelectionProbability(density, exposure) {
  const normalizedDensity = clamp01(Number(density));
  const normalizedExposure = clamp01(Number(exposure));
  const exposureMultiplier =
    HERO_MINIMUM_EXPOSURE_MULTIPLIER +
    normalizedExposure * HERO_EXPOSURE_RANGE;
  return clamp01(normalizedDensity * exposureMultiplier);
}

export function selectHeroLeafSamples(treeData, density) {
  return treeData.shell.filter((sample) => {
    const probability = calculateHeroLeafSelectionProbability(
      density,
      sample.exposure,
    );
    return hashUnit(treeData.seed, sample.id, HERO_SELECTION_SALT) <= probability;
  });
}

export function calculateHeroClusterStretch(seed, sampleId, layer) {
  const elementId = sampleId + layer * HERO_LAYER_ID_STRIDE;
  return Object.freeze({
    x:
      HERO_MINIMUM_CLUSTER_STRETCH +
      hashUnit(seed, elementId, HERO_STRETCH_X_SALT) *
        HERO_CLUSTER_STRETCH_RANGE,
    z:
      HERO_MINIMUM_CLUSTER_STRETCH +
      hashUnit(seed, elementId, HERO_STRETCH_Z_SALT) *
        HERO_CLUSTER_STRETCH_RANGE,
  });
}
