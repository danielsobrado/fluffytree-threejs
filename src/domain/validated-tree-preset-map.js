import { validateTreePresetConfig } from './tree-preset-config-validator.js';
import { createTreePresetMap } from './tree-preset.js';

export function createValidatedTreePresetMap(config) {
  if (
    !config?.presets ||
    typeof config.presets !== 'object' ||
    Array.isArray(config.presets)
  ) {
    throw new Error("Tree configuration must define a 'presets' object.");
  }

  for (const [id, value] of Object.entries(config.presets)) {
    validateTreePresetConfig(id, value);
  }

  return createTreePresetMap(config);
}
