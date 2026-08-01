import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';
import {
  allocateSectionSamples,
  createCanopyCrossSection,
  findNearestInteriorTarget,
  interpolateHeight,
  moveInside,
  pointAtHeight,
} from './canopy-cross-section.js';
import { createClosureSample } from './canopy-closure-sample.js';
import {
  hashUnit,
  interpolate,
  randomDirection,
} from './canopy-closure-math.js';

function createVolumeSamples(treeData, field, settings, startId) {
  const samples = [];

  for (let slice = 0; slice < settings.volumeSlices; slice += 1) {
    const height = interpolateHeight(
      field.bounds,
      (slice + 0.5) / settings.volumeSlices,
      CANOPY_CLOSURE_CONSTANTS.volumeHeightPaddingRatio,
    );
    const crossSection = createCanopyCrossSection(treeData.lobes, height);
    if (!crossSection) continue;

    const allocations = allocateSectionSamples(
      crossSection.sections,
      settings.samplesPerSlice,
    );

    for (const allocation of allocations) {
      for (let index = 0; index < allocation.count; index += 1) {
        const id = startId + samples.length;
        const radiusRatio =
          Math.sqrt((index + 0.5) / allocation.count) * settings.radiusRatio;
        const angle =
          index * CANOPY_CLOSURE_CONSTANTS.goldenAngle +
          slice * 0.71 +
          hashUnit(treeData.seed, id, 0x6d2b79f5) * 0.45;
        const candidate = {
          x:
            allocation.section.center.x +
            Math.cos(angle) * allocation.section.radiusX * radiusRatio,
          y:
            height +
            (hashUnit(treeData.seed, id, 0xc2b2ae35) - 0.5) *
              allocation.section.radius *
              settings.axialJitter,
          z:
            allocation.section.center.z +
            Math.sin(angle) * allocation.section.radiusZ * radiusRatio,
        };
        const target = findNearestInteriorTarget(
          field,
          candidate,
          crossSection.sections,
        );
        const position = moveInside(field, candidate, target);
        if (!position) continue;

        const scaleJitter = interpolate(
          CANOPY_CLOSURE_CONSTANTS.volumeScaleMinimum,
          CANOPY_CLOSURE_CONSTANTS.volumeScaleMaximum,
          hashUnit(treeData.seed, id, 0x27d4eb2d),
        );
        samples.push(
          createClosureSample({
            id,
            position,
            normal: randomDirection(treeData.seed, id, 0.08),
            scale:
              allocation.section.radius *
              settings.clusterScaleRatio *
              scaleJitter,
            colorMix:
              allocation.section.lobe.colorMix - settings.colorDrop,
            role: 'volume',
          }),
        );
      }
    }
  }

  return samples;
}

function createTrunkSamples(treeData, field, settings, startId) {
  const samples = [];

  for (let slice = 0; slice < settings.trunkSlices; slice += 1) {
    const height = interpolateHeight(
      field.bounds,
      (slice + 0.5) / settings.trunkSlices,
      CANOPY_CLOSURE_CONSTANTS.trunkHeightPaddingRatio,
    );
    const crossSection = createCanopyCrossSection(treeData.lobes, height);
    const trunkCenter = pointAtHeight(treeData.trunk.points, height);
    if (!crossSection || !trunkCenter) continue;

    const localRadius = Math.min(crossSection.radiusX, crossSection.radiusZ);
    const maximumDistance =
      localRadius * CANOPY_CLOSURE_CONSTANTS.trunkOutsideDistanceRatio;
    const sampleCount = settings.trunkRingCount + 1;

    for (let index = 0; index < sampleCount; index += 1) {
      const id = startId + samples.length;
      const radialRatio =
        index === 0 ? 0 : Math.sqrt(index / settings.trunkRingCount);
      const angle =
        index * CANOPY_CLOSURE_CONSTANTS.goldenAngle +
        hashUnit(treeData.seed, id, 0x165667b1) * 0.4;
      const candidate = {
        x:
          trunkCenter.x +
          Math.cos(angle) *
            localRadius *
            settings.trunkRadiusRatio *
            radialRatio,
        y:
          height +
          (hashUnit(treeData.seed, id, 0x94d049bb) - 0.5) *
            localRadius *
            settings.axialJitter,
        z:
          trunkCenter.z +
          Math.sin(angle) *
            localRadius *
            settings.trunkRadiusRatio *
            radialRatio,
      };
      const target = findNearestInteriorTarget(
        field,
        trunkCenter,
        crossSection.sections,
      );
      const position = moveInside(field, candidate, target, maximumDistance);
      if (!position) continue;

      samples.push(
        createClosureSample({
          id,
          position,
          normal: randomDirection(treeData.seed, id, 0.02),
          scale:
            localRadius *
            settings.clusterScaleRatio *
            CANOPY_CLOSURE_CONSTANTS.trunkScaleMultiplier,
          colorMix: crossSection.colorMix - settings.colorDrop * 1.15,
          role: 'trunk',
        }),
      );
    }
  }

  return samples;
}

export class CanopyVolumeSampler {
  generate(treeData, field, settings, startId = 1_000_000) {
    const volume = createVolumeSamples(treeData, field, settings, startId);
    const trunk = createTrunkSamples(
      treeData,
      field,
      settings,
      startId + 1_000_000,
    );
    return Object.freeze([...volume, ...trunk]);
  }
}
