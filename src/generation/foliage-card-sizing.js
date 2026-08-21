import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js?v=2.0.0-20260814.2';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js?v=2.0.0-20260814.2';

function midpoint(pair) {
  return (Number(pair[0]) + Number(pair[1])) * 0.5;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function clampCardWidthFactor(value, settings, maximumSpread) {
  const spread = Math.max(1, Number(maximumSpread));
  const halfSpread = Math.sqrt(spread);
  const center = midpoint(settings.sizeRatio) * midpoint(settings.widthRatio);

  return clamp(value, center / halfSpread, center * halfSpread);
}

function createSizing(
  meanScale,
  settings,
  maximumSpread,
  scaleRatio,
  widthRatio,
) {
  const scale = meanScale * scaleRatio;
  const widthFactor = clampCardWidthFactor(
    scaleRatio * widthRatio,
    settings,
    maximumSpread ??
      FOLIAGE_SHELL_CONSTANTS.defaultMaximumShellCardWidthSpread,
  );
  const shellScale = meanScale * (widthFactor / widthRatio);
  const cardWidth =
    shellScale *
    widthRatio *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;

  return Object.freeze({
    scale,
    shellScale,
    widthRatio,
    cardWidth,
    coverageRadius: cardWidth * Number(settings.coverageCardRatio),
  });
}

export function createFoliageCardSizing(
  meanScale,
  settings,
  maximumSpread,
  random,
) {
  return createSizing(
    meanScale,
    settings,
    maximumSpread,
    random.range(settings.sizeRatio[0], settings.sizeRatio[1]),
    random.range(settings.widthRatio[0], settings.widthRatio[1]),
  );
}

export function createMaximumFoliageCardSizing(
  meanScale,
  settings,
  maximumSpread,
) {
  return createSizing(
    meanScale,
    settings,
    maximumSpread,
    Number(settings.sizeRatio[1]),
    Number(settings.widthRatio[1]),
  );
}
