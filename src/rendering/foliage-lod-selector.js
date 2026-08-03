import { FOLIAGE_LOD_CONSTANTS } from './foliage-lod-constants.js';

function validateDensity(density) {
  if (!Number.isFinite(density) || density < 0 || density > 1) {
    throw new RangeError(`Foliage LOD density must be between 0 and 1; received ${density}.`);
  }
}

function compareLobeIds(left, right) {
  if (typeof left === 'number' && typeof right === 'number') return left - right;
  return String(left).localeCompare(String(right));
}

function compareInstanceIds(left, right) {
  if (typeof left.id === 'number' && typeof right.id === 'number') {
    return left.id - right.id;
  }
  return String(left.id).localeCompare(String(right.id));
}

function groupByLobe(instances) {
  const groups = new Map();

  instances.forEach((instance, sourceIndex) => {
    const group = groups.get(instance.lobeId) ?? [];
    group.push({ instance, sourceIndex });
    groups.set(instance.lobeId, group);
  });

  return [...groups.entries()]
    .sort(([left], [right]) => compareLobeIds(left, right))
    .map(([lobeId, entries]) => ({ lobeId, entries, count: 1, remainder: 0 }));
}

function allocateCounts(groups, targetCount) {
  const remaining = targetCount - groups.length;
  const totalCapacity = groups.reduce(
    (total, group) => total + Math.max(0, group.entries.length - 1),
    0,
  );

  if (remaining <= 0 || totalCapacity <= 0) return;

  let allocated = 0;
  for (const group of groups) {
    const capacity = Math.max(0, group.entries.length - 1);
    const exact = (capacity * remaining) / totalCapacity;
    const extra = Math.min(capacity, Math.floor(exact));
    group.count += extra;
    group.remainder = exact - extra;
    allocated += extra;
  }

  let outstanding = remaining - allocated;
  const byRemainder = [...groups].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      compareLobeIds(left.lobeId, right.lobeId),
  );

  while (outstanding > 0) {
    let progressed = false;

    for (const group of byRemainder) {
      if (group.count >= group.entries.length) continue;
      group.count += 1;
      outstanding -= 1;
      progressed = true;
      if (outstanding === 0) break;
    }

    if (!progressed) break;
  }
}

function signNotZero(value) {
  return value < 0 ? -1 : 1;
}

function encodeOctahedral(normal) {
  const length = Math.abs(normal.x) + Math.abs(normal.y) + Math.abs(normal.z);
  if (length <= Number.EPSILON) return { x: 0.5, y: 0.5 };

  let x = normal.x / length;
  let y = normal.y / length;
  const z = normal.z / length;

  if (z < 0) {
    const originalX = x;
    x = (1 - Math.abs(y)) * signNotZero(originalX);
    y = (1 - Math.abs(originalX)) * signNotZero(y);
  }

  return { x: x * 0.5 + 0.5, y: y * 0.5 + 0.5 };
}

function spreadBits(value) {
  let result = value & 0x000003ff;
  result = (result | (result << 16)) & 0x030000ff;
  result = (result | (result << 8)) & 0x0300f00f;
  result = (result | (result << 4)) & 0x030c30c3;
  result = (result | (result << 2)) & 0x09249249;
  return result;
}

function surfaceKey(instance) {
  const encoded = encodeOctahedral(instance.normal);
  const resolution = FOLIAGE_LOD_CONSTANTS.octahedralResolution;
  const x = Math.round(encoded.x * resolution);
  const y = Math.round(encoded.y * resolution);
  return spreadBits(x) | (spreadBits(y) << 1);
}

function compareSurfaceEntries(left, right) {
  return (
    left.surfaceKey - right.surfaceKey ||
    compareInstanceIds(left.instance, right.instance) ||
    left.sourceIndex - right.sourceIndex
  );
}

function isBetterRepresentative(candidate, current) {
  const candidateExposure = Number(candidate.instance.exposure ?? 0);
  const currentExposure = Number(current.instance.exposure ?? 0);
  return (
    candidateExposure > currentExposure ||
    (candidateExposure === currentExposure &&
      compareInstanceIds(candidate.instance, current.instance) < 0)
  );
}

function selectGroup(entries, count) {
  if (count >= entries.length) return entries;

  const ordered = entries
    .map((entry) => ({ ...entry, surfaceKey: surfaceKey(entry.instance) }))
    .sort(compareSurfaceEntries);
  const selected = [];

  for (let index = 0; index < count; index += 1) {
    const start = Math.floor((index * ordered.length) / count);
    const end = Math.max(start + 1, Math.floor(((index + 1) * ordered.length) / count));
    let representative = ordered[start];

    for (let candidateIndex = start + 1; candidateIndex < end; candidateIndex += 1) {
      const candidate = ordered[candidateIndex];
      if (isBetterRepresentative(candidate, representative)) {
        representative = candidate;
      }
    }

    selected.push(representative);
  }

  return selected;
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
    });
  }

  if (density === 1) {
    return Object.freeze({
      instances,
      actualDensity: 1,
      scaleCompensation: 1,
    });
  }

  const groups = groupByLobe(instances);
  const targetCount = Math.min(
    instances.length,
    Math.max(groups.length, Math.round(instances.length * density)),
  );
  allocateCounts(groups, targetCount);

  const selected = groups
    .flatMap((group) => selectGroup(group.entries, group.count))
    .sort((left, right) => left.sourceIndex - right.sourceIndex)
    .map((entry) => entry.instance);
  const actualDensity = selected.length / instances.length;

  return Object.freeze({
    instances: Object.freeze(selected),
    actualDensity,
    scaleCompensation: calculateScaleCompensation(actualDensity),
  });
}
