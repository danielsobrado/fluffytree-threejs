import { hashCanonicalValue } from '../core/canonical-value-hash.js';

const MAXIMUM_SEED = 0xffffffff;

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${label} must be a positive integer.`);
  }
  return value;
}

function normalizeSeed(seed) {
  if (
    typeof seed !== 'number' ||
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > MAXIMUM_SEED
  ) {
    throw new RangeError(
      `Tree generation cache seed must be an unsigned 32-bit integer; received '${seed}'.`,
    );
  }
  return seed >>> 0;
}

function normalizeOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Tree generation cache options must be an object.');
  }
  if (options.includeSurfaceSamples !== undefined) return options;
  return { ...options, includeSurfaceSamples: true };
}

export function calculateTreeGenerationCacheCapacity(
  speciesCount,
  maximumVariantsPerSpecies,
) {
  return (
    requirePositiveInteger(speciesCount, 'Tree generation cache species count') *
    requirePositiveInteger(
      maximumVariantsPerSpecies,
      'Tree generation cache variants per species',
    )
  );
}

export class CachedTreeGenerator {
  constructor({ generator, maximumEntries }) {
    if (!generator?.generate) {
      throw new TypeError('CachedTreeGenerator requires a tree generator.');
    }

    this.generator = generator;
    this.maximumEntries = requirePositiveInteger(
      maximumEntries,
      'Tree generation cache maximum entries',
    );
    this.entries = new Map();
    this.presetKeys = new WeakMap();
    this.nextPresetKey = 1;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  presetKey(preset) {
    if (!preset || typeof preset !== 'object') {
      throw new TypeError('CachedTreeGenerator requires an object preset.');
    }

    if (!this.presetKeys.has(preset)) {
      this.presetKeys.set(preset, this.nextPresetKey);
      this.nextPresetKey += 1;
    }
    return this.presetKeys.get(preset);
  }

  cacheKey(preset, seed, options) {
    const normalizedSeed = normalizeSeed(seed);
    const optionHash = hashCanonicalValue(options);
    return `${this.presetKey(preset)}:${normalizedSeed}:${optionHash}`;
  }

  get(key) {
    if (!this.entries.has(key)) return null;

    const value = this.entries.get(key);
    this.entries.delete(key);
    this.entries.set(key, value);
    this.hits += 1;
    return value;
  }

  set(key, value) {
    this.entries.set(key, value);
    while (this.entries.size > this.maximumEntries) {
      const oldestKey = this.entries.keys().next().value;
      this.entries.delete(oldestKey);
      this.evictions += 1;
    }
  }

  generate(preset, seed, options = {}) {
    const normalizedOptions = normalizeOptions(options);
    const key = this.cacheKey(preset, seed, normalizedOptions);
    const cached = this.get(key);
    if (cached) return cached;

    if (normalizedOptions.includeSurfaceSamples === false) {
      const fullKey = this.cacheKey(preset, seed, {
        ...normalizedOptions,
        includeSurfaceSamples: true,
      });
      const full = this.get(fullKey);
      if (full) return full;
    }

    this.misses += 1;
    const generated = this.generator.generate(preset, seed, options);

    if (normalizedOptions.includeSurfaceSamples === true) {
      const compactKey = this.cacheKey(preset, seed, {
        ...normalizedOptions,
        includeSurfaceSamples: false,
      });
      this.entries.delete(compactKey);
    }

    this.set(key, generated);
    return generated;
  }

  clear() {
    this.entries.clear();
    this.presetKeys = new WeakMap();
    this.nextPresetKey = 1;
  }

  get metrics() {
    return Object.freeze({
      size: this.entries.size,
      maximumEntries: this.maximumEntries,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    });
  }
}
