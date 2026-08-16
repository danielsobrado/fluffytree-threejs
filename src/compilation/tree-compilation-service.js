import { BoundedLruCache } from '../core/bounded-lru-cache.js';
import { RefCountedResourceCache } from '../core/ref-counted-resource-cache.js';
import { createRepresentationCacheKey, createTreeIrCacheKey } from './tree-cache-key.js';
import { TreeRepresentationCompiler } from './tree-representation-compiler.js';

export class TreeCompilationService {
  constructor({
    treeGenerator,
    qualityProfile,
    representationCompiler = new TreeRepresentationCompiler(),
    treeIrCache = null,
    representationCache = null,
  }) {
    if (!treeGenerator || typeof treeGenerator.generateIr !== 'function') {
      throw new TypeError('TreeCompilationService requires a TreeGenerator.');
    }
    if (!qualityProfile?.cache) {
      throw new TypeError('TreeCompilationService requires a quality profile.');
    }
    this.treeGenerator = treeGenerator;
    this.qualityProfile = qualityProfile;
    this.representationCompiler = representationCompiler;
    this.treeIrCache =
      treeIrCache ??
      new BoundedLruCache({
        maximumEntries: qualityProfile.cache.treeIrMaximumEntries,
      });
    this.representationCache =
      representationCache ??
      new RefCountedResourceCache({
        maximumEntries: qualityProfile.cache.representationMaximumEntries,
      });
  }

  getTreeIr(
    preset,
    seed,
    {
      generationOptions = {},
      environment = null,
      environmentSignature = environment,
    } = {},
  ) {
    const key = createTreeIrCacheKey({
      preset,
      seed,
      generationOptions,
      environmentSignature,
    });
    return this.treeIrCache.getOrCreate(key, () =>
      this.treeGenerator.generateIr(preset, seed, {
        ...generationOptions,
        ...(environment === null ? {} : { environment }),
      }),
    );
  }

  acquireRepresentation(treeIr, role) {
    const key = createRepresentationCacheKey({
      treeIr,
      role,
      qualityProfile: this.qualityProfile,
      compilerVersion: this.representationCompiler.compilerVersion,
    });
    return this.representationCache.acquire(key, () =>
      this.representationCompiler.compile(
        treeIr,
        role,
        this.qualityProfile,
      ),
    );
  }

  clear() {
    this.treeIrCache.clear();
    this.representationCache.clear();
  }

  get metrics() {
    return Object.freeze({
      treeIr: this.treeIrCache.metrics,
      representations: this.representationCache.metrics,
    });
  }
}
