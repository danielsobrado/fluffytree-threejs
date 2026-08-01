import { CANOPY_CLOSURE_CONSTANTS } from './canopy-closure-constants.js';
import {
  createCanopyCrossSection,
  findNearestInteriorTarget,
  moveInside,
} from './canopy-cross-section.js';
import { createClosureSample } from './canopy-closure-sample.js';
import {
  hashUnit,
  interpolate,
  randomDirection,
} from './canopy-closure-math.js';

function findTopLobe(lobes) {
  return lobes.reduce((highest, lobe) =>
    lobe.position.y + lobe.scale.y > highest.position.y + highest.scale.y
      ? lobe
      : highest,
  );
}

export class CanopyCapSampler {
  generate(treeData, field, settings, startId = 4_000_000) {
    const samples = [];
    const topLobe = findTopLobe(treeData.lobes);
    const top = topLobe.position.y + topLobe.scale.y;

    for (let layer = 0; layer < settings.capLayers; layer += 1) {
      const depthRatio = interpolate(
        CANOPY_CLOSURE_CONSTANTS.capDepthMinimumRatio,
        CANOPY_CLOSURE_CONSTANTS.capDepthMaximumRatio,
        settings.capLayers <= 1 ? 0.5 : layer / (settings.capLayers - 1),
      );
      const height = top - topLobe.scale.y * depthRatio;
      const crossSection = createCanopyCrossSection(treeData.lobes, height);
      if (!crossSection) continue;

      for (let index = 0; index < settings.capSamplesPerLayer; index += 1) {
        const id = startId + samples.length;
        const radialRatio =
          Math.sqrt((index + 0.5) / settings.capSamplesPerLayer) *
          settings.radiusRatio *
          0.82;
        const angle =
          index * CANOPY_CLOSURE_CONSTANTS.goldenAngle + layer * 0.83;
        const candidate = {
          x:
            topLobe.position.x +
            Math.cos(angle) * crossSection.radiusX * radialRatio,
          y:
            height -
            hashUnit(treeData.seed, id, 0x94d049bb) *
              crossSection.radius *
              settings.axialJitter *
              0.35,
          z:
            topLobe.position.z +
            Math.sin(angle) * crossSection.radiusZ * radialRatio,
        };
        const target = findNearestInteriorTarget(
          field,
          candidate,
          crossSection.sections,
        );
        const position = moveInside(field, candidate, target);
        if (!position) continue;

        samples.push(
          createClosureSample({
            id,
            position,
            normal: randomDirection(treeData.seed, id, 0.65),
            scale:
              crossSection.radius *
              settings.clusterScaleRatio *
              CANOPY_CLOSURE_CONSTANTS.capScaleMultiplier,
            colorMix: crossSection.colorMix - settings.colorDrop * 0.55,
            role: 'cap',
          }),
        );
      }
    }

    return Object.freeze(samples);
  }
}
