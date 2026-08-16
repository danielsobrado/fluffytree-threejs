import { resolveFoliageContinuityProfile } from './foliage-continuity-config.js';
import { createTreePreset } from './tree-preset.js';
import { resolveTreeGenerationModelId } from '../generation/tree-generation-model.js';

/**
 * The editable side of the preset configuration.
 *
 * `createTreePreset` produces a deeply frozen value that is deliberately hard to
 * mutate, which is what the generator wants and exactly what a tuning UI cannot
 * use. The library keeps the plain configuration next to the validated preset so
 * an editor can round-trip a value, hand it back, and have it revalidated before
 * anything downstream sees it.
 */

function clone(value) {
  return structuredClone(value);
}

export class PresetLibrary {
  static fromConfig(config, continuityConfig = null) {
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

  /** A detached copy, safe for an editor to mutate. */
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
      value.generationModel,
      `${id}.generationModel`,
    );
    const continuity = resolveFoliageContinuityProfile(
      this.continuityConfig,
      basePreset.crown.profile,
    );
    return Object.freeze({ ...basePreset, generationModel, continuity });
  }

  /** Validates before storing, so a rejected edit leaves the library untouched. */
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
