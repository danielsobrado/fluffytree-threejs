import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../rendering/foliage-rendering-constants.js';

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

export function createFoliageCardSizing(
  meanScale,
  settings,
  maximumSpread,
  random,
) {
  const scaleRatio = random.range(settings.sizeRatio[0], settings.sizeRatio[1]);
  const widthRatio = random.range(
    settings.widthRatio[0],
    settings.widthRatio[1],
  );
  const scale = meanScale * scaleRatio;
  const widthFactor = clampCardWidthFactor(
    scaleRatio * widthRatio,
    settings,
    maximumSpread ??
      FOLIAGE_SHELL_CONSTANTS.defaultMaximumShellCardWidthSpread,
  );
  const physicalCoverageRatio = Math.min(
    Number(settings.coverageCardRatio),
    FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio,
  );
  const geometryCompensation =
    Number(settings.coverageCardRatio) / physicalCoverageRatio;
  const shellScale =
    meanScale * (widthFactor / widthRatio) * geometryCompensation;
  const cardWidth =
    shellScale *
    widthRatio *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;

  return Object.freeze({
    scale,
    shellScale,
    widthRatio,
    cardWidth,
    coverageRadius: cardWidth * physicalCoverageRatio,
    physicalCoverageRatio,
  });
}
