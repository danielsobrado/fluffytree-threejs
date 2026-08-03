import { selectDeterministicFoliageMaxCover } from '../generation/foliage-max-cover-selector.js';
import { FOLIAGE_LOD_CONSTANTS } from './foliage-lod-constants.js';

function validateDensity(density) {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError(
      `Foliage LOD density must be between 0 and 1; received ${density}.`,
    );
  }
}

function countLobes(instances) {
  return new Set(instances.map((instance) => instance.lobeId)).size;
}

function calculateScaleCompensation(actualDensity) {
  if (actualDensity <= 0 || actualDensity >= 1) return 1;
  return Math.min(
    FOLIAGE_LOD_CONSTANTS.maximumScaleCompensation,
    1 / Math.sqrt(actualDensity),
  );
}

export function selectFoliageLodInstances(instances, density) {
  validateDensity(density);

  if (instances.length === 0 || density === 0) {
    return Object.freeze({
      instances: Object.freeze([]),
      actualDensity: 0,
      scaleCompensation: 1,
      maximumCoverageRatio: 0,
    });
  }

  if (density === 1) {
    return Object.freeze({
      instances,
      actualDensity: 1,
      scaleCompensation: 1,
      maximumCoverageRatio: 0,
    });
  }

  const targetCount = Math.min(
    instances.length,
    Math.max(countLobes(instances), Math.round(instances.length * density)),
  );
  const sourceOrder = new Map(
    instances.map((instance, index) => [instance, index]),
  );
  const selection = selectDeterministicFoliageMaxCover(instances, {
    targetCount,
    stopCoverageRatio: null,
    minimumPerLobe: true,
  });
  const selected = [...selection.selected].sort(
    (left, right) => sourceOrder.get(left) - sourceOrder.get(right),
  );
  const actualDensity = selected.length / instances.length;

  return Object.freeze({
    instances: Object.freeze(selected),
    actualDensity,
    scaleCompensation: calculateScaleCompensation(actualDensity),
    maximumCoverageRatio: selection.maximumCoverageRatio,
  });
}
