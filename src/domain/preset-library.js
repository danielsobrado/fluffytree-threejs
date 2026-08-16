import { resolveFoliageContinuityProfile } from './foliage-continuity-config.js';
import { createTreePreset } from './tree-preset.js';
import { resolveTreeGenerationModelId } from '../generation/tree-generation-model.js';

function clone(value) {
  return structuredClone(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}

function configEntries(config) {
  if (
    !config?.presets ||
    typeof config.presets !== 'object' ||
    Array.isArray(config.presets)
  ) {
    throw new Error("Tree configuration must define a 'presets' object.");
  }

  const entries = Object.entries(config.presets);
  if (entries.length === 0) {
    throw new Error("Tree configuration 'presets' must not be empty.");
  }
  return entries;
}

export class PresetLibrary {
  static fromConfig(config, continuityConfig = null) {
    return PresetLibrary.fromConfigs([config], continuityConfig);
  }

  static fromConfigs(configs, continuityConfig = null) {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new Error('Tree configurations must be a non-empty array.');
    }

    const entries = [];
    const ids = new Set();
    for (const config of configs) {
      for (const [id, value] of configEntries(config)) {
        if (ids.has(id)) {
          throw new Error(`Duplicate tree preset '${id}'.`);
        }
        ids.add(id);
        entries.push([id, value]);
      }
    }
    return new PresetLibrary(entries, continuityConfig);
  }

  constructor(entries = [], continuityConfig = null) {
    this.values = new Map();
    this.presets = new Map();
    this.continuityConfig = continuityConfig;

    for (const [id, value] of entries) this.set(id, value);
  }

  get ids() {
    return [...this.values.keys()];
  }

  has(id) {
    return this.presets.has(id);
  }

  get(id) {
    return this.presets.get(id);
  }

  rawValue(id) {
    const value = this.values.get(id);

    if (!value) {
      throw new Error(`Unknown tree preset '${id}'.`);
    }

    return clone(value);
  }

  validate(id, value) {
    const basePreset = createTreePreset(id, value);
    const generationModel = resolveTreeGenerationModelId(
      value?.generationModel,
      `${id}.generationModel`,
    );
    const continuity = resolveFoliageContinuityProfile(
      this.continuityConfig,
      basePreset.crown.profile,
    );
    const morphology = value?.morphology ?? {};
    if (
      !morphology ||
      typeof morphology !== 'object' ||
      Array.isArray(morphology)
    ) {
      throw new Error(`Configuration '${id}.morphology' must be an object.`);
    }
    return Object.freeze({
      ...basePreset,
      generationModel,
      continuity,
      morphology: deepFreeze(clone(morphology)),
    });
  }

  set(id, value) {
    const preset = this.validate(id, value);
    this.values.set(id, clone(value));
    this.presets.set(id, preset);
    return preset;
  }

  remove(id) {
    this.values.delete(id);
    this.presets.delete(id);
  }

  toConfig(ids = this.ids) {
    return {
      presets: Object.fromEntries(
        ids
          .filter((id) => this.values.has(id))
          .map((id) => [id, clone(this.values.get(id))]),
      ),
    };
  }
}
