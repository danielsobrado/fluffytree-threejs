import { FoliageCoverageIndex } from '../generation/foliage-coverage-index.js';
import { selectDeterministicFoliageMaxCover } from '../generation/foliage-max-cover-selector.js';
import { FOLIAGE_LOD_CONSTANTS } from './foliage-lod-constants.js';

const SELECTION_CACHE = new WeakMap();

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

function getCachedSelection(instances, density) {
  return SELECTION_CACHE.get(instances)?.get(density) ?? null;
}

function cacheSelection(instances, density, selection) {
  const entries = SELECTION_CACHE.get(instances) ?? new Map();
  entries.set(density, selection);
  SELECTION_CACHE.set(instances, entries);
  return selection;
}

function isCoverageRepair(instance) {
  return typeof instance.coverageRepairKind === 'string';
}

function selectRequiredCoverageInstances(instances) {
  const required = new Set(
    instances.filter((instance) => isCoverageRepair(instance)),
  );
  const representedLobes = new Set(
    [...required].map((instance) => instance.lobeId),
  );
  const lobeCount = countLobes(instances);
  const anchors = selectDeterministicFoliageMaxCover(instances, {
    targetCount: lobeCount,
    stopCoverageRatio: null,
    minimumPerLobe: true,
  }).selected;

  for (const anchor of anchors) {
    if (representedLobes.has(anchor.lobeId)) continue;
    required.add(anchor);
    representedLobes.add(anchor.lobeId);
  }

  return required;
}

function mergeRequiredWithDistribution(
  instances,
  required,
  distribution,
  targetCount,
) {
  const selected = new Set(required);

  for (const instance of distribution) {
    if (selected.size >= targetCount) break;
    selected.add(instance);
  }
  if (selected.size < targetCount) {
    for (const instance of instances) {
      if (selected.size >= targetCount) break;
      selected.add(instance);
    }
  }

  const sourceOrder = new Map(
    instances.map((instance, index) => [instance, index]),
  );
  return [...selected].sort(
    (left, right) => sourceOrder.get(left) - sourceOrder.get(right),
  );
}

function maximumCoverageRadius(instances) {
  let maximum = 0;
  for (const instance of instances) {
    maximum = Math.max(maximum, Number(instance.coverageRadius));
  }
  return maximum;
}

function calculateMaximumCoverageRatio(instances, selected) {
  if (instances.length === 0 || selected.length === 0) return 0;

  const index = new FoliageCoverageIndex(maximumCoverageRadius(instances));
  for (const instance of selected) index.add(instance);

  let maximum = 0;
  for (const instance of instances) {
    maximum = Math.max(maximum, index.nearestRatio(instance));
  }
  return maximum;
}

export function selectFoliageLodInstances(instances, density) {
  validateDensity(density);

  if (instances.length === 0 || density === 0) {
    return Object.freeze({
      instances: Object.freeze([]),
      actualDensity: 0,
      scaleCompensation: 1,
      maximumCoverageRatio: 0,
      coverageRepairInvariantCount: 0,
      coverageLimited: false,
    });
  }

  if (density === 1) {
    return Object.freeze({
      instances,
      actualDensity: 1,
      scaleCompensation: 1,
      maximumCoverageRatio: 0,
      coverageRepairInvariantCount: instances.filter(isCoverageRepair).length,
      coverageLimited: false,
    });
  }

  const cached = getCachedSelection(instances, density);
  if (cached) return cached;

  const requestedTargetCount = Math.min(
    instances.length,
    Math.max(countLobes(instances), Math.round(instances.length * density)),
  );
  const required = selectRequiredCoverageInstances(instances);
  const targetCount = Math.min(
    instances.length,
    Math.max(requestedTargetCount, required.size),
  );
  const distribution = selectDeterministicFoliageMaxCover(instances, {
    targetCount,
    stopCoverageRatio: null,
    minimumPerLobe: true,
  });
  const selected = mergeRequiredWithDistribution(
    instances,
    required,
    distribution.selected,
    targetCount,
  );
  const actualDensity = selected.length / instances.length;
  const result = Object.freeze({
    instances: Object.freeze(selected),
    actualDensity,
    scaleCompensation: calculateScaleCompensation(actualDensity),
    maximumCoverageRatio: calculateMaximumCoverageRatio(instances, selected),
    coverageRepairInvariantCount: [...required].filter(isCoverageRepair).length,
    coverageLimited: targetCount > requestedTargetCount,
  });

  return cacheSelection(instances, density, result);
}
