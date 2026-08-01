import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';
import {
  distanceSquared,
  interpolate,
  interpolatePoint,
} from './canopy-closure-math.js';

function createLobeSection(lobe, height) {
  const verticalRadius = Math.max(
    CANOPY_CLOSURE_CONSTANTS.minimumSectionRadius,
    lobe.scale.y,
  );
  const verticalRatio = (height - lobe.position.y) / verticalRadius;
  if (Math.abs(verticalRatio) >= 1) return null;

  const sectionRatio = Math.sqrt(
    Math.max(0, 1 - verticalRatio * verticalRatio),
  );
  const radiusX = Math.max(
    CANOPY_CLOSURE_CONSTANTS.minimumSectionRadius,
    lobe.scale.x * sectionRatio,
  );
  const radiusZ = Math.max(
    CANOPY_CLOSURE_CONSTANTS.minimumSectionRadius,
    lobe.scale.z * sectionRatio,
  );

  return Object.freeze({
    lobe,
    center: Object.freeze({
      x: lobe.position.x,
      y: height,
      z: lobe.position.z,
    }),
    radiusX,
    radiusZ,
    radius: Math.sqrt(radiusX * radiusZ),
    area: Math.PI * radiusX * radiusZ,
  });
}

export function createCanopyCrossSection(lobes, height) {
  const sections = lobes
    .map((lobe) => createLobeSection(lobe, height))
    .filter(Boolean);
  if (sections.length === 0) return null;

  let totalArea = 0;
  let centerX = 0;
  let centerZ = 0;
  let minimumX = Number.POSITIVE_INFINITY;
  let maximumX = Number.NEGATIVE_INFINITY;
  let minimumZ = Number.POSITIVE_INFINITY;
  let maximumZ = Number.NEGATIVE_INFINITY;
  let colorMix = 0;

  for (const section of sections) {
    totalArea += section.area;
    centerX += section.center.x * section.area;
    centerZ += section.center.z * section.area;
    colorMix += section.lobe.colorMix * section.area;
    minimumX = Math.min(minimumX, section.center.x - section.radiusX);
    maximumX = Math.max(maximumX, section.center.x + section.radiusX);
    minimumZ = Math.min(minimumZ, section.center.z - section.radiusZ);
    maximumZ = Math.max(maximumZ, section.center.z + section.radiusZ);
  }

  const radiusX = Math.max(
    CANOPY_CLOSURE_CONSTANTS.minimumSectionRadius,
    (maximumX - minimumX) * 0.5,
  );
  const radiusZ = Math.max(
    CANOPY_CLOSURE_CONSTANTS.minimumSectionRadius,
    (maximumZ - minimumZ) * 0.5,
  );

  return Object.freeze({
    height,
    sections: Object.freeze(sections),
    center: Object.freeze({
      x: centerX / totalArea,
      y: height,
      z: centerZ / totalArea,
    }),
    radiusX,
    radiusZ,
    radius: Math.sqrt(radiusX * radiusZ),
    colorMix: colorMix / totalArea,
  });
}

export function allocateSectionSamples(sections, totalCount) {
  const totalArea = sections.reduce((sum, section) => sum + section.area, 0);
  const allocations = sections.map((section) => {
    const exact = (section.area / totalArea) * totalCount;
    return {
      section,
      count: Math.floor(exact),
      remainder: exact - Math.floor(exact),
    };
  });

  let assigned = allocations.reduce(
    (sum, allocation) => sum + allocation.count,
    0,
  );
  const ranked = [...allocations].sort(
    (left, right) => right.remainder - left.remainder,
  );

  for (let index = 0; assigned < totalCount; index += 1) {
    ranked[index % ranked.length].count += 1;
    assigned += 1;
  }

  return allocations;
}

export function findNearestInteriorTarget(field, point, sections) {
  if (field.sample(point) <= -CANOPY_CLOSURE_CONSTANTS.minimumFieldInset) {
    return point;
  }

  const candidates = [...sections].sort(
    (left, right) =>
      distanceSquared(left.center, point) -
      distanceSquared(right.center, point),
  );

  for (const section of candidates) {
    if (
      field.sample(section.center) <=
      -CANOPY_CLOSURE_CONSTANTS.minimumFieldInset
    ) {
      return section.center;
    }
  }

  return candidates[0]?.center ?? point;
}

export function moveInside(
  field,
  candidate,
  target,
  maximumDistance = -CANOPY_CLOSURE_CONSTANTS.minimumFieldInset,
) {
  let position = { ...candidate };

  for (
    let step = 0;
    step < CANOPY_CLOSURE_CONSTANTS.inwardCorrectionSteps;
    step += 1
  ) {
    if (field.sample(position) <= maximumDistance) return position;
    position = interpolatePoint(
      position,
      target,
      CANOPY_CLOSURE_CONSTANTS.inwardCorrectionRatio,
    );
  }

  return field.sample(target) <= maximumDistance ? { ...target } : null;
}

export function pointAtHeight(path, height) {
  if (!Array.isArray(path) || path.length === 0) return null;

  for (let index = 1; index < path.length; index += 1) {
    const previous = path[index - 1];
    const current = path[index];
    const minimumY = Math.min(previous.y, current.y);
    const maximumY = Math.max(previous.y, current.y);
    if (height < minimumY || height > maximumY) continue;

    const span = current.y - previous.y;
    const ratio =
      Math.abs(span) <= 1e-6 ? 0 : (height - previous.y) / span;
    return interpolatePoint(previous, current, ratio);
  }

  const first = path[0];
  const last = path.at(-1);
  return height <= first.y ? { ...first } : { ...last };
}

export function interpolateHeight(bounds, ratio, paddingRatio) {
  const height = bounds.maximum.y - bounds.minimum.y;
  const minimum = bounds.minimum.y + height * paddingRatio;
  const maximum = bounds.maximum.y - height * paddingRatio;
  return interpolate(minimum, maximum, ratio);
}
