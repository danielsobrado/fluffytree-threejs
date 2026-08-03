const STORAGE_KEY = 'fluffytree.tuning.variants.v1';

/**
 * Named preset configurations the user saved from the tuning panel.
 *
 * Backed by `localStorage` when it is available and by memory when it is not,
 * because the demo is opened from `file://` often enough that a throwing store
 * would take the whole panel down with it. A variant records the preset it was
 * derived from so loading one can restore the same tree family.
 */

function createMemoryStorage() {
  const entries = new Map();

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
}

function resolveStorage() {
  try {
    const storage = globalThis.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, '1');
    storage.removeItem(probe);
    return storage;
  } catch {
    return createMemoryStorage();
  }
}

export class PresetVariantStore {
  constructor(storage = resolveStorage()) {
    this.storage = storage;
  }

  read() {
    try {
      const parsed = JSON.parse(this.storage.getItem(STORAGE_KEY) ?? '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  write(variants) {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(variants));
      return true;
    } catch {
      return false;
    }
  }

  /** Newest first, so the list reads as a history of what was tried. */
  list() {
    return Object.entries(this.read())
      .map(([name, variant]) => ({
        name,
        basePresetId: variant.basePresetId ?? null,
        savedAt: variant.savedAt ?? 0,
      }))
      .sort((left, right) => right.savedAt - left.savedAt);
  }

  load(name) {
    const variant = this.read()[name];
    return variant?.value ? structuredClone(variant) : null;
  }

  save(name, basePresetId, value) {
    const variants = this.read();
    variants[name] = {
      basePresetId,
      savedAt: Date.now(),
      value: structuredClone(value),
    };
    return this.write(variants);
  }

  remove(name) {
    const variants = this.read();
    if (!(name in variants)) return false;
    delete variants[name];
    return this.write(variants);
  }

  /** Everything saved, shaped like `config/tree-presets.yaml`. */
  toPresetConfig() {
    const variants = this.read();
    const presets = {};

    for (const [name, variant] of Object.entries(variants)) {
      if (!variant?.value) continue;
      const baseId = toPresetId(name);
      let presetId = baseId;
      let suffix = 2;

      // Distinct display names can collapse to the same YAML-safe id (for
      // example, "Old pine" and "Old-pine"). Preserve every saved setting
      // instead of silently replacing the earlier one in the export.
      while (Object.hasOwn(presets, presetId)) {
        presetId = `${baseId}${suffix}`;
        suffix += 1;
      }

      presets[presetId] = structuredClone(variant.value);
    }

    return { presets };
  }
}

/** A YAML mapping key that survives a round trip through the config loader. */
export function toPresetId(name) {
  const cleaned = String(name)
    .trim()
    .replace(/[^A-Za-z0-9]+(.)?/g, (_match, next) =>
      next ? next.toUpperCase() : '',
    );
  const identifier = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
  return /^[A-Za-z]/.test(identifier) ? identifier : `variant${cleaned}`;
}
