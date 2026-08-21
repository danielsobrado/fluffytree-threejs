import { BoundedLruCache } from '../core/bounded-lru-cache.js?v=2.0.0-20260814.2';
import { createTreeIrCacheKey } from '../compilation/tree-cache-key.js?v=2.0.0-20260814.2';

export class WorkerTreeGenerationService {
  constructor({ workerPool, maximumCacheEntries = 128 } = {}) {
    if (!workerPool || typeof workerPool.submit !== 'function') {
      throw new TypeError('WorkerTreeGenerationService requires a worker pool.');
    }
    this.workerPool = workerPool;
    this.cache = new BoundedLruCache({ maximumEntries: maximumCacheEntries });
    this.inflight = new Map();
  }

  generate(preset, seed, { generationOptions = {}, priority = 0 } = {}) {
    const key = createTreeIrCacheKey({
      preset,
      seed,
      generationOptions,
    });
    const cached = this.cache.get(key);
    if (cached !== undefined) return Promise.resolve(cached);

    const pending = this.inflight.get(key);
    if (pending) return pending;

    const promise = this.workerPool
      .submit({
        key,
        priority,
        preset,
        seed,
        options: generationOptions,
      })
      .then((treeIr) => {
        this.cache.getOrCreate(key, () => treeIr);
        return treeIr;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  destroy() {
    this.inflight.clear();
    this.cache.clear();
    this.workerPool.destroy?.();
  }

  get metrics() {
    return Object.freeze({
      cache: this.cache.metrics,
      worker: this.workerPool.metrics,
    });
  }
}
