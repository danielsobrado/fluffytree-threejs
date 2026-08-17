import {
  treeIrStyleSigned,
  treeIrStyleUnit,
} from './tree-ir-style-random.js';

export function calculateTreeIrCrownStyle(treeIr, volume, config) {
  const variation = config.shapeVariation;
  return Object.freeze({
    scaleX: 1 + treeIrStyleSigned(treeIr, volume.id, 'crown-scale-x') * variation,
    scaleY: 1 + treeIrStyleSigned(treeIr, volume.id, 'crown-scale-y') * variation,
    scaleZ: 1 + treeIrStyleSigned(treeIr, volume.id, 'crown-scale-z') * variation,
    brightness:
      config.brightness *
      (0.96 + treeIrStyleUnit(treeIr, volume.id, 'crown-brightness') * 0.08),
  });
}
