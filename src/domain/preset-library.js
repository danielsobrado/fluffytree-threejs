import { compileTreePreset } from './tree-preset-compiler.js?v=2.0.0-20260814.2';

function clone(value) {
  return structuredClone(value);
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
    return compileTreePreset(id, value, this.continuityConfig);
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
