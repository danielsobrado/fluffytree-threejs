import {
  treeIrStyleSigned,
  treeIrStyleUnit,
} from './tree-ir-style-random.js';

export function calculateTreeIrCrownStyle(treeIr, volume, config, exposure = 1) {
  const variation = config.shapeVariation;
  const depthBrightness = 1 - config.depthShading * (1 - exposure);
  return Object.freeze({
    scaleX: 1 + treeIrStyleSigned(treeIr, volume.id, 'crown-scale-x') * variation,
    scaleY: 1 + treeIrStyleSigned(treeIr, volume.id, 'crown-scale-y') * variation,
    scaleZ: 1 + treeIrStyleSigned(treeIr, volume.id, 'crown-scale-z') * variation,
    brightness:
      config.brightness *
      depthBrightness *
      (0.96 + treeIrStyleUnit(treeIr, volume.id, 'crown-brightness') * 0.08),
  });
}
