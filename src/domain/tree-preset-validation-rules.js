export const REQUIRED_NUMBER_PATHS = Object.freeze([
  'height',
  'crown.baseHeight',
  'crown.height',
  'crown.radius',
  'crown.radialBias',
  'crown.asymmetry',
  'crown.surfaceTension',
  'crown.lobeScaleMultiplier',
  'crown.scaleVariation',
  'crown.clumps.separation',
  'crown.clumps.anchoring',
  'crown.clumps.silhouetteBreakup',
  'trunk.baseRadius',
  'trunk.topRadius',
  'trunk.bend',
  'trunk.flare',
  'trunk.branching.lengthDecay',
  'trunk.branching.radiusDecay',
  'trunk.branching.upwardBias',
  'trunk.branching.gnarl',
  'trunk.branching.twist',
  'trunk.branching.exposedTipRatio',
  'foliage.variation',
  'foliage.paletteBase',
  'foliage.heightPaletteShift',
  'foliage.exposurePaletteShift',
  'foliage.radialNormalStrength',
  'foliage.crownNormalBlend',
  'foliage.wrapLight',
  'foliage.skyLightStrength',
  'foliage.cavityStrength',
  'foliage.heightLightStrength',
  'foliage.volume.smoothing',
  'foliage.volume.padding',
  'foliage.volume.noiseAmplitude',
  'foliage.volume.noiseFrequency',
  'foliage.volume.normalEpsilon',
  'foliage.volume.colorPatchScale',
  'foliage.volume.colorPatchStrength',
  'foliage.core.scale',
  'foliage.core.brightness',
  'foliage.heroLeaves.density',
  'foliage.heroLeaves.scale',
  'foliage.heroLeaves.embedRatio',
  'foliage.heroLeaves.protrusionRatio',
  'foliage.heroLeaves.colorLift',
  'foliage.heroLeaves.colorJitter',
  'foliage.heroLeaves.roughness',
  'foliage.heroLeaves.layerOffsetRatio',
  'foliage.shell.coverageCardRatio',
  'foliage.shell.radialOffsetRatio',
  'foliage.shell.exposureThreshold',
  'foliage.shell.colorJitter',
  'foliage.shell.paletteLift',
  'foliage.shell.cavityScale',
  'foliage.shell.normalBlend',
  'foliage.shell.alphaTest',
  'foliage.shell.shadowProxyScale',
]);

export const OPTIONAL_NUMBER_PATHS = Object.freeze([
  'trunk.movement',
  'trunk.curveCount',
  'trunk.sweep',
  'trunk.taperPower',
  'trunk.nebari',
]);

export const POSITIVE_NUMBER_PATHS = Object.freeze([
  'height',
  'crown.height',
  'crown.radius',
  'trunk.baseRadius',
  'trunk.topRadius',
]);

export const NON_NEGATIVE_NUMBER_PATHS = Object.freeze([
  'crown.baseHeight',
  'trunk.bend',
]);

export const UNIT_INTERVAL_PATHS = Object.freeze([
  'crown.radialBias',
  'crown.asymmetry',
]);

export const INTEGER_RULES = Object.freeze([
  Object.freeze({ path: 'crown.lobeCount', minimum: 1 }),
  Object.freeze({ path: 'crown.clumps.macroCount', minimum: 1 }),
  Object.freeze({ path: 'trunk.segments', minimum: 2 }),
  Object.freeze({ path: 'trunk.branchCount', minimum: 0 }),
  Object.freeze({ path: 'trunk.branching.depth', minimum: 1 }),
  Object.freeze({ path: 'trunk.branching.primaryCount', minimum: 1 }),
  Object.freeze({ path: 'foliage.volume.resolution', minimum: 1 }),
  Object.freeze({ path: 'foliage.heroLeaves.leavesPerCluster', minimum: 1 }),
  Object.freeze({ path: 'foliage.heroLeaves.layerCount', minimum: 1 }),
  Object.freeze({ path: 'foliage.shell.candidatesPerLobe', minimum: 1 }),
  Object.freeze({ path: 'foliage.shell.planesPerCluster', minimum: 1 }),
]);

export const PAIR_RULES = Object.freeze([
  Object.freeze({ path: 'crown.lobeScale', positive: true }),
  Object.freeze({ path: 'crown.verticalScale', positive: true }),
  Object.freeze({ path: 'crown.lean' }),
  Object.freeze({
    path: 'crown.clumps.subClumpCount',
    positive: true,
    integer: true,
  }),
  Object.freeze({
    path: 'trunk.branching.childCount',
    positive: true,
    integer: true,
  }),
  Object.freeze({ path: 'foliage.shell.sizeRatio', positive: true }),
  Object.freeze({ path: 'foliage.shell.widthRatio', positive: true }),
  Object.freeze({ path: 'foliage.shell.outwardRatio', positive: true }),
]);

export const STRING_ARRAY_RULES = Object.freeze([
  Object.freeze({ path: 'trunk.barkPalette', minimumLength: 3 }),
  Object.freeze({ path: 'foliage.palette', minimumLength: 2 }),
]);
