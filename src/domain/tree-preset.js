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
];

const REQUIRED_TRUNK_FIELDS = [
  'baseRadius',
  'topRadius',
  'bend',
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
  'wrapLight',
  'skyLightStrength',
  'cavityStrength',
  'heightLightStrength',
  'shell',
];

const REQUIRED_SHELL_FIELDS = [
  'instancesPerLobe',
  'candidateMultiplier',
  'sizeRatio',
  'radialOffsetRatio',
  'exposureThreshold',
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

function createFoliageConfig(id, foliage) {
  requireFields(foliage, REQUIRED_FOLIAGE_FIELDS, `${id}.foliage`);
  requireFields(
    foliage.shell,
    REQUIRED_SHELL_FIELDS,
    `${id}.foliage.shell`,
  );

  const palette = freezeArray(foliage.palette, `${id}.foliage.palette`);
  if (!palette.every((color) => typeof color === 'string')) {
    throw new Error(`Configuration '${id}.foliage.palette' must contain colors.`);
  }

  requireRange(foliage.variation, 0, 1, `${id}.foliage.variation`);
  requireRange(foliage.paletteBase, 0, 1, `${id}.foliage.paletteBase`);
  requireRange(
    foliage.radialNormalStrength,
    0,
    1,
    `${id}.foliage.radialNormalStrength`,
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
  requirePositiveInteger(
    foliage.shell.instancesPerLobe,
    `${id}.foliage.shell.instancesPerLobe`,
  );
  requirePositiveInteger(
    foliage.shell.candidateMultiplier,
    `${id}.foliage.shell.candidateMultiplier`,
  );
  requirePositiveInteger(
    foliage.shell.planesPerCluster,
    `${id}.foliage.shell.planesPerCluster`,
  );
  requireRange(
    foliage.shell.exposureThreshold,
    0,
    1,
    `${id}.foliage.shell.exposureThreshold`,
  );
  requireRange(
    foliage.shell.alphaTest,
    0,
    1,
    `${id}.foliage.shell.alphaTest`,
  );
  requireRange(
    foliage.shell.shadowProxyScale,
    0.5,
    1.2,
    `${id}.foliage.shell.shadowProxyScale`,
  );

  const sizeRatio = freezeArray(
    foliage.shell.sizeRatio,
    `${id}.foliage.shell.sizeRatio`,
  );

  if (sizeRatio.length !== 2 || sizeRatio[0] <= 0 || sizeRatio[1] < sizeRatio[0]) {
    throw new Error(
      `Configuration '${id}.foliage.shell.sizeRatio' must be [minimum, maximum].`,
    );
  }

  return Object.freeze({
    ...foliage,
    palette,
    shell: Object.freeze({
      ...foliage.shell,
      sizeRatio,
    }),
  });
}

export function createTreePreset(id, value) {
  if (!id || !value || typeof value !== 'object') {
    throw new Error('A tree preset requires an id and configuration object.');
  }

  requireFields(value.crown, REQUIRED_CROWN_FIELDS, `${id}.crown`);
  requireFields(value.trunk, REQUIRED_TRUNK_FIELDS, `${id}.trunk`);

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
