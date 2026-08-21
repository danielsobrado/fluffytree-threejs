import {
  treeIrStyleSigned,
  treeIrStyleUnit,
} from './tree-ir-style-random.js?v=2.0.0-20260814.2';

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function canopyExposure(treeIr, site) {
  const bounds = treeIr.bounds;
  if (!bounds?.minimum || !bounds?.maximum) {
    return { height: 0.5, radial: 0.5 };
  }

  const heightSpan = Math.max(
    Number.EPSILON,
    bounds.maximum.y - bounds.minimum.y,
  );
  const halfX = Math.max(
    Number.EPSILON,
    (bounds.maximum.x - bounds.minimum.x) * 0.5,
  );
  const halfZ = Math.max(
    Number.EPSILON,
    (bounds.maximum.z - bounds.minimum.z) * 0.5,
  );
  const centerX = (bounds.minimum.x + bounds.maximum.x) * 0.5;
  const centerZ = (bounds.minimum.z + bounds.maximum.z) * 0.5;
  const position = site.frame.position;
  const normalizedX = (position.x - centerX) / halfX;
  const normalizedZ = (position.z - centerZ) / halfZ;

  return {
    height: clamp01((position.y - bounds.minimum.y) / heightSpan),
    radial: clamp01(
      Math.hypot(normalizedX, normalizedZ) / Math.SQRT2,
    ),
  };
}

export function calculateTreeIrFoliageCardStyle(treeIr, site, config) {
  const scaleVariation =
    1 +
    treeIrStyleSigned(treeIr, site.id, 'card-scale') *
      config.cardScaleVariation;
  const stretch =
    treeIrStyleSigned(treeIr, site.id, 'card-stretch') * config.cardStretch;
  const lean = config.cardLean ?? 0;
  const exposure = canopyExposure(treeIr, site);
  const exposureBrightness =
    1 +
    (exposure.height - 0.5) * (config.canopyHeightTint ?? 0) +
    (exposure.radial - 0.5) * (config.canopyRadialTint ?? 0);

  return Object.freeze({
    widthScale: scaleVariation * (1 + stretch),
    heightScale: scaleVariation * (1 - stretch * 0.55),
    twist:
      treeIrStyleSigned(treeIr, site.id, 'card-twist') * config.cardTwist,
    leanX: treeIrStyleSigned(treeIr, site.id, 'card-lean-x') * lean,
    leanZ: treeIrStyleSigned(treeIr, site.id, 'card-lean-z') * lean,
    colorMix: treeIrStyleUnit(treeIr, site.id, 'card-color'),
    brightness:
      (0.96 + treeIrStyleUnit(treeIr, site.id, 'card-brightness') * 0.08) *
      exposureBrightness,
    canopyHeight: exposure.height,
    canopyRadial: exposure.radial,
  });
}
