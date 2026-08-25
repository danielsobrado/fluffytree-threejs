import { BoundedLruCache } from '../core/bounded-lru-cache.js';
import { createTreeIrCacheKey } from '../compilation/tree-cache-key.js';

export class WorkerTreeGenerationService {
  constructor({ workerPool, maximumCacheEntries = 128 } = {}) {
    if (!workerPool || typeof workerPool.submit !== 'function') {
      throw new TypeError('WorkerTreeGenerationService requires a worker pool.');
    }
    this.workerPool = workerPool;
    this.cache = new BoundedLruCache({ maximumEntries: maximumCacheEntries });
    this.inflight = new Map();
    this.destroyed = false;
  }

  generate(preset, seed, { generationOptions = {}, priority = 0 } = {}) {
    if (this.destroyed) {
      return Promise.reject(new Error('Worker tree generation service is destroyed.'));
    }

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
        if (this.destroyed) {
          throw new Error('Worker tree generation service was destroyed before completion.');
        }
        this.cache.set(key, treeIr);
        return treeIr;
      })
      .finally(() => {
        if (this.inflight.get(key) === promise) this.inflight.delete(key);
      });

    this.inflight.set(key, promise);
    return promise;
  }

  cancelAll() {
    if (this.destroyed || typeof this.workerPool.cancel !== 'function') return 0;

    let cancelled = 0;
    for (const key of this.inflight.keys()) {
      if (this.workerPool.cancel(key)) cancelled += 1;
    }
    return cancelled;
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
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
