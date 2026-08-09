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

function boundaryAt(level, settings) {
  if (level === 0) return settings.nearPixels;
  if (level === 1) return settings.mediumPixels;
  if (level === 2) return settings.farPixels;
  if (level === 3) return settings.cullPixels;
  return 0;
}

function resetWeights(target) {
  target[0] = 0;
  target[1] = 0;
  target[2] = 0;
  target[3] = 0;
  return target;
}

export function resolveStableLod(projectedPixels, previousLevel, settings) {
  const candidate = rawLevel(projectedPixels, settings);
  if (candidate === previousLevel) return candidate;

  if (candidate > previousLevel && previousLevel < 4) {
    return projectedPixels <
      boundaryAt(previousLevel, settings) * (1 - settings.hysteresis)
      ? candidate
      : previousLevel;
  }
  if (candidate < previousLevel && candidate < 4) {
    return projectedPixels >
      boundaryAt(candidate, settings) * (1 + settings.hysteresis)
      ? candidate
      : previousLevel;
  }
  return candidate;
}

export function calculateLodWeights(
  projectedPixels,
  settings,
  target = [0, 0, 0, 0],
) {
  const weights = resetWeights(target);
  const near = blendAtThreshold(
    projectedPixels,
    settings.nearPixels,
    settings.fadeBand,
  );
  if (near > 0) {
    weights[0] = near;
    weights[1] = 1 - near;
    return weights;
  }
  const medium = blendAtThreshold(
    projectedPixels,
    settings.mediumPixels,
    settings.fadeBand,
  );
  if (medium > 0) {
    weights[1] = medium;
    weights[2] = 1 - medium;
    return weights;
  }
  const far = blendAtThreshold(
    projectedPixels,
    settings.farPixels,
    settings.fadeBand,
  );
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
  target = null,
) {
  const weights = target ?? new Array(sourceWeights.length);
  if (weights !== sourceWeights) {
    for (let index = 0; index < sourceWeights.length; index += 1) {
      weights[index] = sourceWeights[index];
    }
  }
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
