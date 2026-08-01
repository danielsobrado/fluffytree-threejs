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
];

const REQUIRED_TRUNK_FIELDS = [
  'baseRadius',
  'topRadius',
  'bend',
  'flare',
  'segments',
  'branchCount',
  'color',
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
  'leafDetail',
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

const REQUIRED_LEAF_DETAIL_FIELDS = [
  'enabled',
  'density',
  'scale',
  'embedRatio',
  'protrusionRatio',
  'leavesPerCluster',
  'colorLift',
  'colorJitter',
  'roughness',
  'coreScale',
  'coreBrightness',
  'layerCount',
  'layerOffsetRatio',
];

const REQUIRED_SHELL_FIELDS = [
  'instancesPerLobe',
  'candidateMultiplier',
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
    throw new Error(`Configuration '${path}' must contain at least ${minimumLength} values.`);
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
}

function validateTrunkTuning(id, trunk) {
  requireRange(trunk.flare, 0, 1.5, `${id}.trunk.flare`);
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

function validateLeafDetailTuning(id, leafDetail) {
  const path = `${id}.foliage.leafDetail`;

  if (typeof leafDetail.enabled !== 'boolean') {
    throw new Error(`Configuration '${path}.enabled' must be a boolean.`);
  }

  requireRange(leafDetail.density, 0, 1, `${path}.density`);
  requireRange(leafDetail.scale, 0.1, 3, `${path}.scale`);
  requireRange(leafDetail.embedRatio, 0, 0.5, `${path}.embedRatio`);
  requireRange(
    leafDetail.protrusionRatio,
    0,
    0.5,
    `${path}.protrusionRatio`,
  );
  requirePositiveInteger(leafDetail.leavesPerCluster, `${path}.leavesPerCluster`);
  requireRange(leafDetail.colorLift, -1, 1, `${path}.colorLift`);
  requireRange(leafDetail.colorJitter, 0, 1, `${path}.colorJitter`);
  requireRange(leafDetail.roughness, 0, 1, `${path}.roughness`);
  requireRange(leafDetail.coreScale, 0.55, 0.95, `${path}.coreScale`);
  requireRange(
    leafDetail.coreBrightness,
    0.2,
    1,
    `${path}.coreBrightness`,
  );
  requirePositiveInteger(leafDetail.layerCount, `${path}.layerCount`);
  requireRange(leafDetail.layerCount, 1, 4, `${path}.layerCount`);
  requireRange(
    leafDetail.layerOffsetRatio,
    0,
    0.5,
    `${path}.layerOffsetRatio`,
  );
}

function validateShellTuning(id, shell) {
  requirePositiveInteger(
    shell.instancesPerLobe,
    `${id}.foliage.shell.instancesPerLobe`,
  );
  requirePositiveInteger(
    shell.candidateMultiplier,
    `${id}.foliage.shell.candidateMultiplier`,
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
    foliage.leafDetail,
    REQUIRED_LEAF_DETAIL_FIELDS,
    `${id}.foliage.leafDetail`,
  );
  requireFields(foliage.shell, REQUIRED_SHELL_FIELDS, `${id}.foliage.shell`);

  const palette = freezeArray(foliage.palette, `${id}.foliage.palette`);
  if (!palette.every((color) => typeof color === 'string')) {
    throw new Error(`Configuration '${id}.foliage.palette' must contain colors.`);
  }

  validateFoliageTuning(id, foliage);
  validateVolumeTuning(id, foliage.volume);
  validateLeafDetailTuning(id, foliage.leafDetail);
  validateShellTuning(id, foliage.shell);

  return Object.freeze({
    ...foliage,
    palette,
    volume: Object.freeze({ ...foliage.volume }),
    leafDetail: Object.freeze({ ...foliage.leafDetail }),
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
    },
    trunk: { ...value.trunk },
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
    Object.entries(config.presets).map(([id, value]) => [id, createTreePreset(id, value)]),
  );
}
