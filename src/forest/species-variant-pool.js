import { hashCanonicalValue } from '../core/canonical-value-hash.js';

const GOLDEN_RATIO_UINT32 = 0x9e3779b9;
const VARIANT_SEED_SALT = 0x6a09e667;
const HERO_SEED_SALT = 0xbb67ae85;
const WIND_PHASE_SCALE = Math.PI * 2;

function mixUint32(value) {
  let hash = value >>> 0;
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d) >>> 0;
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function hashValueToUint32(value) {
  return Number.parseInt(hashCanonicalValue(value).slice(0, 8), 16) >>> 0;
}

function unit(value) {
  return (value >>> 0) / 0x100000000;
}

function range(pair, ratio) {
  return pair[0] + (pair[1] - pair[0]) * ratio;
}

function validateVariantCount(variantCount, maximum) {
  if (
    !Number.isSafeInteger(variantCount) ||
    variantCount < 1 ||
    variantCount > maximum
  ) {
    throw new RangeError(
      `Species variant count must be an integer within [1, ${maximum}].`,
    );
  }
  return variantCount;
}

export class SpeciesVariantPool {
  constructor({
    preset,
    compilationService,
    policy,
    variantCount = policy?.maximumPerSpecies,
    baseSeed = 0,
    generationOptions = {},
  }) {
    if (!preset?.id) throw new TypeError('SpeciesVariantPool requires a preset.');
    if (!compilationService?.getTreeIr) {
      throw new TypeError('SpeciesVariantPool requires a compilation service.');
    }
    if (!policy?.maximumPerSpecies) {
      throw new TypeError('SpeciesVariantPool requires a variant policy.');
    }
    if (!Number.isSafeInteger(baseSeed) || baseSeed < 0 || baseSeed > 0xffffffff) {
      throw new RangeError('Species variant baseSeed must be an unsigned 32-bit integer.');
    }

    this.preset = preset;
    this.compilationService = compilationService;
    this.policy = policy;
    this.variantCount = validateVariantCount(
      variantCount,
      policy.maximumPerSpecies,
    );
    this.baseSeed = baseSeed >>> 0;
    this.generationOptions = Object.freeze({ ...generationOptions });
    this.variants = new Map();
    this.sharedRequests = 0;
    this.heroRequests = 0;
  }

  seedForVariant(index) {
    if (!Number.isSafeInteger(index) || index < 0 || index >= this.variantCount) {
      throw new RangeError(`Variant index must be within [0, ${this.variantCount - 1}].`);
    }
    return mixUint32(
      this.baseSeed ^
        VARIANT_SEED_SALT ^
        Math.imul(index + 1, GOLDEN_RATIO_UINT32),
    );
  }

  variantIndexForInstance(instanceId) {
    return hashValueToUint32([this.preset.id, instanceId]) % this.variantCount;
  }

  variationForInstance(instanceId) {
    const base = hashValueToUint32([this.preset.id, instanceId, this.baseSeed]);
    const second = mixUint32(base ^ 0xa54ff53a);
    const third = mixUint32(second ^ 0x510e527f);
    const fourth = mixUint32(third ^ 0x1f83d9ab);
    return Object.freeze({
      scale: range(this.policy.scaleRange, unit(base)),
      colorOffset: range(this.policy.colorOffsetRange, unit(second)),
      windStrength: range(this.policy.windStrengthRange, unit(third)),
      windPhase: unit(fourth) * WIND_PHASE_SCALE,
      rotationOffset: (unit(mixUint32(fourth)) * 2 - 1) * this.policy.rotationJitter,
    });
  }

  getVariant(index) {
    const seed = this.seedForVariant(index);
    if (!this.variants.has(index)) {
      this.variants.set(
        index,
        Object.freeze({
          index,
          seed,
          treeIr: this.compilationService.getTreeIr(this.preset, seed, {
            generationOptions: this.generationOptions,
          }),
        }),
      );
    }
    return this.variants.get(index);
  }

  resolveInstance(instanceId, { hero = false } = {}) {
    const variation = this.variationForInstance(instanceId);
    if (hero) {
      this.heroRequests += 1;
      const instanceHash = hashValueToUint32([this.preset.id, instanceId]);
      const seed = mixUint32(this.baseSeed ^ HERO_SEED_SALT ^ instanceHash);
      return Object.freeze({
        presetId: this.preset.id,
        instanceId,
        shared: false,
        variantIndex: null,
        seed,
        variation,
      });
    }

    this.sharedRequests += 1;
    const variantIndex = this.variantIndexForInstance(instanceId);
    const variant = this.getVariant(variantIndex);
    return Object.freeze({
      presetId: this.preset.id,
      instanceId,
      shared: true,
      variantIndex,
      seed: variant.seed,
      variation,
    });
  }

  getTreeIr(assignment) {
    if (assignment.shared) return this.getVariant(assignment.variantIndex).treeIr;
    return this.compilationService.getTreeIr(this.preset, assignment.seed, {
      generationOptions: this.generationOptions,
    });
  }

  acquireRepresentation(instanceId, role, options = {}) {
    const assignment = this.resolveInstance(instanceId, options);
    const treeIr = this.getTreeIr(assignment);
    const lease = this.compilationService.acquireRepresentation(treeIr, role);
    return Object.freeze({ assignment, treeIr, lease });
  }

  get metrics() {
    return Object.freeze({
      presetId: this.preset.id,
      variantCount: this.variantCount,
      generatedVariantCount: this.variants.size,
      sharedRequests: this.sharedRequests,
      heroRequests: this.heroRequests,
    });
  }
}
