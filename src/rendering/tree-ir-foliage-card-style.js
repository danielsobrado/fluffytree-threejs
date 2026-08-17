import {
  treeIrStyleSigned,
  treeIrStyleUnit,
} from './tree-ir-style-random.js';

export function calculateTreeIrFoliageCardStyle(treeIr, site, config) {
  const scaleVariation =
    1 +
    treeIrStyleSigned(treeIr, site.id, 'card-scale') *
      config.cardScaleVariation;
  const stretch =
    treeIrStyleSigned(treeIr, site.id, 'card-stretch') * config.cardStretch;

  return Object.freeze({
    widthScale: scaleVariation * (1 + stretch),
    heightScale: scaleVariation * (1 - stretch * 0.55),
    twist:
      treeIrStyleSigned(treeIr, site.id, 'card-twist') * config.cardTwist,
    brightness: 0.96 + treeIrStyleUnit(treeIr, site.id, 'card-brightness') * 0.08,
  });
}
