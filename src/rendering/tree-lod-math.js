function smoothstep(value) {
  const ratio = Math.min(1, Math.max(0, value));
  return ratio * ratio * (3 - 2 * ratio);
}

function blendAtThreshold(value, threshold, band) {
  const halfWidth = Math.max(0.001, threshold * band * 0.5);
  return smoothstep((value - (threshold - halfWidth)) / (halfWidth * 2));
}

function rawLevel(projectedPixels, settings) {
  if (projectedPixels >= settings.nearPixels) return 0;
  if (projectedPixels >= settings.mediumPixels) return 1;
  if (projectedPixels >= settings.farPixels) return 2;
  if (projectedPixels >= settings.cullPixels) return 3;
  return 4;
}

export function resolveStableLod(projectedPixels, previousLevel, settings) {
  const candidate = rawLevel(projectedPixels, settings);
  if (candidate === previousLevel) return candidate;
  const boundaries = [
    settings.nearPixels,
    settings.mediumPixels,
    settings.farPixels,
    settings.cullPixels,
  ];
  if (candidate > previousLevel && previousLevel < boundaries.length) {
    return projectedPixels < boundaries[previousLevel] * (1 - settings.hysteresis)
      ? candidate
      : previousLevel;
  }
  if (candidate < previousLevel && candidate < boundaries.length) {
    return projectedPixels > boundaries[candidate] * (1 + settings.hysteresis)
      ? candidate
      : previousLevel;
  }
  return candidate;
}

export function calculateLodWeights(projectedPixels, settings) {
  const weights = [0, 0, 0, 0];
  const thresholds = [settings.nearPixels, settings.mediumPixels, settings.farPixels];
  const near = blendAtThreshold(projectedPixels, thresholds[0], settings.fadeBand);
  if (near > 0) {
    weights[0] = near;
    weights[1] = 1 - near;
    return weights;
  }
  const medium = blendAtThreshold(projectedPixels, thresholds[1], settings.fadeBand);
  if (medium > 0) {
    weights[1] = medium;
    weights[2] = 1 - medium;
    return weights;
  }
  const far = blendAtThreshold(projectedPixels, thresholds[2], settings.fadeBand);
  if (far > 0) {
    weights[2] = far;
    weights[3] = 1 - far;
    return weights;
  }
  weights[3] = blendAtThreshold(
    projectedPixels,
    settings.cullPixels,
    settings.fadeBand,
  );
  return weights;
}

export function remapUnavailableLodWeights(
  sourceWeights,
  { minimumLevel = 0, heroReady = true } = {},
) {
  const weights = [...sourceWeights];
  const firstAvailableLevel = Math.min(
    weights.length - 1,
    Math.max(0, Math.trunc(minimumLevel)),
  );

  for (let index = 0; index < firstAvailableLevel; index += 1) {
    weights[firstAvailableLevel] += weights[index];
    weights[index] = 0;
  }

  if (firstAvailableLevel === 0 && !heroReady) {
    weights[1] += weights[0];
    weights[0] = 0;
  }

  return weights;
}
