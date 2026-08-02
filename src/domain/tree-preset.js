const REQUIRED_CROWN_FIELDS = [
  'profile',
  'baseHeight',
  'height',
  'radius',
  'lobeCount',
  'lobeScale',
  'verticalScale',
  'radialBias',
  'asymmetry',
  'lean',
  'surfaceTension',
  'lobeScaleMultiplier',
  'scaleVariation',
  'clumps',
];

const REQUIRED_TRUNK_FIELDS = [
  'baseRadius',
  'topRadius',
  'bend',
  'flare',
  'segments',
  'branchCount',
  'color',
  'branching',
  'barkPalette',
];

const REQUIRED_CLUMP_FIELDS = [
  'macroCount',
  'subClumpCount',
  'separation',
  'anchoring',
  'silhouetteBreakup',
];

const REQUIRED_BRANCHING_FIELDS = [
  'depth',
  'primaryCount',
  'childCount',
  'lengthDecay',
  'radiusDecay',
  'upwardBias',
  'gnarl',
  'twist',
  'exposedTipRatio',
];

const REQUIRED_FOLIAGE_FIELDS = [
  'palette',
  'variation',
  'paletteBase',
  'heightPaletteShift',
  'exposurePaletteShift',
  'radialNormalStrength',
  'crownNormalBlend',
  'wrapLight',
  'skyLightStrength',
  'cavityStrength',
  'heightLightStrength',
  'volume',
  'core',
  'heroLeaves',
  'shell',
];

const REQUIRED_VOLUME_FIELDS = [
  'resolution',
  'smoothing',
  'padding',
  'noiseAmplitude',
  'noiseFrequency',
  'normalEpsilon',
  'colorPatchScale',
  'colorPatchStrength',
];

const REQUIRED_CORE_FIELDS = ['scale', 'brightness'];

const REQUIRED_HERO_LEAF_FIELDS = [
  'enabled',
  'density',
  'scale',
  'embedRatio',
  'protrusionRatio',
  'leavesPerCluster',
  'colorLift',
  'colorJitter',
  'roughness',
  'layerCount',
  'layerOffsetRatio',
];

const REQUIRED_SHELL_FIELDS = [
  'candidatesPerLobe',
  'coverageRadiusRatio',
  'sizeRatio',
  'widthRatio',
  'outwardRatio',
  'radialOffsetRatio',
  'exposureThreshold',
  'colorJitter',
  'paletteLift',
  'cavityScale',
  'normalBlend',
  'alphaTest',
  'planesPerCluster',
  'shadowProxyScale',
];

function requireFields(value, fields, path) {
  if (!value || typeof value !== 'object') {
    throw new Error(`Missing object '${path}'.`);
  }

  for (const field of fields) {
    if (value[field] === undefined) {
      throw new Error(`Missing required configuration '${path}.${field}'.`);
    }
  }
}

function freezeArray(value, path, minimumLength = 2) {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new Error(
      `Configuration '${path}' must contain at least ${minimumLength} values.`,
    );
  }

  return Object.freeze([...value]);
}

function requireFinite(value, path) {
  if (!Number.isFinite(Number(value))) {
    throw new Error(`Configuration '${path}' must be a finite number.`);
  }
}

function requireRange(value, minimum, maximum, path) {
  requireFinite(value, path);
  const number = Number(value);

  if (number < minimum || number > maximum) {
    throw new Error(
      `Configuration '${path}' must be within [${minimum}, ${maximum}].`,
    );
  }
}

function requirePositiveInteger(value, path) {
  requireFinite(value, path);

  if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
    throw new Error(`Configuration '${path}' must be a positive integer.`);
  }
}

function validatePair(value, path) {
  const pair = freezeArray(value, path);

  if (pair.length !== 2 || pair[0] <= 0 || pair[1] < pair[0]) {
    throw new Error(`Configuration '${path}' must be [minimum, maximum].`);
  }

  return pair;
}

function validateCrownTuning(id, crown) {
  requireRange(crown.surfaceTension, 0, 1, `${id}.crown.surfaceTension`);
  requireRange(
    crown.lobeScaleMultiplier,
    0.5,
    2,
    `${id}.crown.lobeScaleMultiplier`,
  );
  requireRange(crown.scaleVariation, 0, 0.5, `${id}.crown.scaleVariation`);
  requireFields(crown.clumps, REQUIRED_CLUMP_FIELDS, `${id}.crown.clumps`);
  requirePositiveInteger(crown.clumps.macroCount, `${id}.crown.clumps.macroCount`);
  validatePair(crown.clumps.subClumpCount, `${id}.crown.clumps.subClumpCount`);
  requireRange(crown.clumps.separation, 0, 1, `${id}.crown.clumps.separation`);
  requireRange(crown.clumps.anchoring, 0, 1, `${id}.crown.clumps.anchoring`);
  requireRange(
    crown.clumps.silhouetteBreakup,
    0,
    1,
    `${id}.crown.clumps.silhouetteBreakup`,
  );
}

function validateTrunkTuning(id, trunk) {
  requireRange(trunk.flare, 0, 1.5, `${id}.trunk.flare`);
  requireFields(trunk.branching, REQUIRED_BRANCHING_FIELDS, `${id}.trunk.branching`);
  requirePositiveInteger(trunk.branching.depth, `${id}.trunk.branching.depth`);
  requirePositiveInteger(
    trunk.branching.primaryCount,
    `${id}.trunk.branching.primaryCount`,
  );
  validatePair(trunk.branching.childCount, `${id}.trunk.branching.childCount`);
  requireRange(trunk.branching.lengthDecay, 0.35, 0.9, `${id}.trunk.branching.lengthDecay`);
  requireRange(trunk.branching.radiusDecay, 0.35, 0.9, `${id}.trunk.branching.radiusDecay`);
  requireRange(trunk.branching.upwardBias, 0, 1, `${id}.trunk.branching.upwardBias`);
  requireRange(trunk.branching.gnarl, 0, 1, `${id}.trunk.branching.gnarl`);
  requireRange(trunk.branching.twist, 0, 1, `${id}.trunk.branching.twist`);
  requireRange(
    trunk.branching.exposedTipRatio,
    0,
    0.8,
    `${id}.trunk.branching.exposedTipRatio`,
  );
  const barkPalette = freezeArray(trunk.barkPalette, `${id}.trunk.barkPalette`, 3);
  if (!barkPalette.every((color) => typeof color === 'string')) {
    throw new Error(`Configuration '${id}.trunk.barkPalette' must contain colors.`);
  }
}

function validateFoliageTuning(id, foliage) {
  requireRange(foliage.variation, 0, 1, `${id}.foliage.variation`);
  requireRange(foliage.paletteBase, 0, 1, `${id}.foliage.paletteBase`);
  requireFinite(foliage.heightPaletteShift, `${id}.foliage.heightPaletteShift`);
  requireFinite(
    foliage.exposurePaletteShift,
    `${id}.foliage.exposurePaletteShift`,
  );
  requireRange(
    foliage.radialNormalStrength,
    0,
    1,
    `${id}.foliage.radialNormalStrength`,
  );
  requireRange(
    foliage.crownNormalBlend,
    0,
    1,
    `${id}.foliage.crownNormalBlend`,
  );
  requireRange(foliage.wrapLight, 0, 1, `${id}.foliage.wrapLight`);
  requireRange(
    foliage.skyLightStrength,
    0,
    1,
    `${id}.foliage.skyLightStrength`,
  );
  requireRange(
    foliage.cavityStrength,
    0,
    1,
    `${id}.foliage.cavityStrength`,
  );
  requireRange(
    foliage.heightLightStrength,
    0,
    1,
    `${id}.foliage.heightLightStrength`,
  );
}

function validateVolumeTuning(id, volume) {
  const path = `${id}.foliage.volume`;
  requirePositiveInteger(volume.resolution, `${path}.resolution`);
  requireRange(volume.resolution, 12, 64, `${path}.resolution`);
  requireRange(volume.smoothing, 0.05, 1.5, `${path}.smoothing`);
  requireRange(volume.padding, 0.05, 1, `${path}.padding`);
  requireRange(volume.noiseAmplitude, 0, 0.25, `${path}.noiseAmplitude`);
  requireRange(volume.noiseFrequency, 0.1, 4, `${path}.noiseFrequency`);
  requireRange(volume.normalEpsilon, 0.001, 0.1, `${path}.normalEpsilon`);
  requireRange(volume.colorPatchScale, 0.05, 4, `${path}.colorPatchScale`);
  requireRange(
    volume.colorPatchStrength,
    0,
    0.35,
    `${path}.colorPatchStrength`,
  );
}

function validateHeroLeafTuning(id, heroLeaves) {
  const path = `${id}.foliage.heroLeaves`;

  if (typeof heroLeaves.enabled !== 'boolean') {
    throw new Error(`Configuration '${path}.enabled' must be a boolean.`);
  }

  requireRange(heroLeaves.density, 0, 1, `${path}.density`);
  requireRange(heroLeaves.scale, 0.1, 3, `${path}.scale`);
  requireRange(heroLeaves.embedRatio, 0, 0.5, `${path}.embedRatio`);
  requireRange(
    heroLeaves.protrusionRatio,
    0,
    0.5,
    `${path}.protrusionRatio`,
  );
  requirePositiveInteger(heroLeaves.leavesPerCluster, `${path}.leavesPerCluster`);
  requireRange(heroLeaves.colorLift, -1, 1, `${path}.colorLift`);
  requireRange(heroLeaves.colorJitter, 0, 1, `${path}.colorJitter`);
  requireRange(heroLeaves.roughness, 0, 1, `${path}.roughness`);
  requirePositiveInteger(heroLeaves.layerCount, `${path}.layerCount`);
  requireRange(heroLeaves.layerCount, 1, 4, `${path}.layerCount`);
  requireRange(
    heroLeaves.layerOffsetRatio,
    0,
    0.5,
    `${path}.layerOffsetRatio`,
  );
}

function validateCoreTuning(id, core) {
  requireRange(core.scale, 0.55, 1.15, `${id}.foliage.core.scale`);
  requireRange(core.brightness, 0.2, 1, `${id}.foliage.core.brightness`);
}

function validateShellTuning(id, shell) {
  requirePositiveInteger(
    shell.candidatesPerLobe,
    `${id}.foliage.shell.candidatesPerLobe`,
  );
  requireRange(
    shell.coverageRadiusRatio,
    0.02,
    0.5,
    `${id}.foliage.shell.coverageRadiusRatio`,
  );
  requirePositiveInteger(
    shell.planesPerCluster,
    `${id}.foliage.shell.planesPerCluster`,
  );
  requireRange(
    shell.radialOffsetRatio,
    0,
    0.25,
    `${id}.foliage.shell.radialOffsetRatio`,
  );
  requireRange(
    shell.exposureThreshold,
    0,
    1,
    `${id}.foliage.shell.exposureThreshold`,
  );
  requireRange(shell.colorJitter, 0, 1, `${id}.foliage.shell.colorJitter`);
  requireRange(shell.paletteLift, -1, 1, `${id}.foliage.shell.paletteLift`);
  requireRange(shell.cavityScale, 0, 1, `${id}.foliage.shell.cavityScale`);
  requireRange(shell.normalBlend, 0, 1, `${id}.foliage.shell.normalBlend`);
  requireRange(shell.alphaTest, 0, 1, `${id}.foliage.shell.alphaTest`);
  requireRange(
    shell.shadowProxyScale,
    0.5,
    1.2,
    `${id}.foliage.shell.shadowProxyScale`,
  );
}

function createFoliageConfig(id, foliage) {
  requireFields(foliage, REQUIRED_FOLIAGE_FIELDS, `${id}.foliage`);
  requireFields(foliage.volume, REQUIRED_VOLUME_FIELDS, `${id}.foliage.volume`);
  requireFields(
    foliage.core,
    REQUIRED_CORE_FIELDS,
    `${id}.foliage.core`,
  );
  requireFields(
    foliage.heroLeaves,
    REQUIRED_HERO_LEAF_FIELDS,
    `${id}.foliage.heroLeaves`,
  );
  requireFields(foliage.shell, REQUIRED_SHELL_FIELDS, `${id}.foliage.shell`);

  const palette = freezeArray(foliage.palette, `${id}.foliage.palette`);
  if (!palette.every((color) => typeof color === 'string')) {
    throw new Error(`Configuration '${id}.foliage.palette' must contain colors.`);
  }

  validateFoliageTuning(id, foliage);
  validateVolumeTuning(id, foliage.volume);
  validateCoreTuning(id, foliage.core);
  validateHeroLeafTuning(id, foliage.heroLeaves);
  validateShellTuning(id, foliage.shell);

  return Object.freeze({
    ...foliage,
    palette,
    volume: Object.freeze({ ...foliage.volume }),
    core: Object.freeze({ ...foliage.core }),
    heroLeaves: Object.freeze({ ...foliage.heroLeaves }),
    shell: Object.freeze({
      ...foliage.shell,
      sizeRatio: validatePair(
        foliage.shell.sizeRatio,
        `${id}.foliage.shell.sizeRatio`,
      ),
      widthRatio: validatePair(
        foliage.shell.widthRatio,
        `${id}.foliage.shell.widthRatio`,
      ),
      outwardRatio: validatePair(
        foliage.shell.outwardRatio,
        `${id}.foliage.shell.outwardRatio`,
      ),
    }),
  });
}

export function createTreePreset(id, value) {
  if (!id || !value || typeof value !== 'object') {
    throw new Error('A tree preset requires an id and configuration object.');
  }

  requireFields(value.crown, REQUIRED_CROWN_FIELDS, `${id}.crown`);
  requireFields(value.trunk, REQUIRED_TRUNK_FIELDS, `${id}.trunk`);
  validateCrownTuning(id, value.crown);
  validateTrunkTuning(id, value.trunk);

  const preset = {
    id,
    label: value.label ?? id,
    height: Number(value.height),
    crown: {
      ...value.crown,
      lobeScale: freezeArray(value.crown.lobeScale, `${id}.crown.lobeScale`),
      verticalScale: freezeArray(
        value.crown.verticalScale,
        `${id}.crown.verticalScale`,
      ),
      lean: freezeArray(value.crown.lean, `${id}.crown.lean`),
      clumps: Object.freeze({
        ...value.crown.clumps,
        subClumpCount: validatePair(
          value.crown.clumps.subClumpCount,
          `${id}.crown.clumps.subClumpCount`,
        ),
      }),
    },
    trunk: {
      ...value.trunk,
      branching: Object.freeze({
        ...value.trunk.branching,
        childCount: validatePair(
          value.trunk.branching.childCount,
          `${id}.trunk.branching.childCount`,
        ),
      }),
      barkPalette: freezeArray(value.trunk.barkPalette, `${id}.trunk.barkPalette`, 3),
    },
    foliage: createFoliageConfig(id, value.foliage),
  };

  return Object.freeze({
    ...preset,
    crown: Object.freeze(preset.crown),
    trunk: Object.freeze(preset.trunk),
  });
}

export function createTreePresetMap(config) {
  if (!config?.presets || typeof config.presets !== 'object') {
    throw new Error("Tree configuration must define a 'presets' object.");
  }

  return new Map(
    Object.entries(config.presets).map(([id, value]) => [
      id,
      createTreePreset(id, value),
    ]),
  );
}
