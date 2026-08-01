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

const REQUIRED_FOLIAGE_FIELDS = ['baseColor', 'lightColor', 'variation'];

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

function freezeArray(value) {
  return Object.freeze([...value]);
}

export function createTreePreset(id, value) {
  if (!id || !value || typeof value !== 'object') {
    throw new Error('A tree preset requires an id and configuration object.');
  }

  requireFields(value.crown, REQUIRED_CROWN_FIELDS, `${id}.crown`);
  requireFields(value.trunk, REQUIRED_TRUNK_FIELDS, `${id}.trunk`);
  requireFields(value.foliage, REQUIRED_FOLIAGE_FIELDS, `${id}.foliage`);

  const preset = {
    id,
    label: value.label ?? id,
    height: Number(value.height),
    crown: {
      ...value.crown,
      lobeScale: freezeArray(value.crown.lobeScale),
      verticalScale: freezeArray(value.crown.verticalScale),
      lean: freezeArray(value.crown.lean),
    },
    trunk: { ...value.trunk },
    foliage: { ...value.foliage },
  };

  return Object.freeze({
    ...preset,
    crown: Object.freeze(preset.crown),
    trunk: Object.freeze(preset.trunk),
    foliage: Object.freeze(preset.foliage),
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
