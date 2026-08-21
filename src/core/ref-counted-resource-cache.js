function requireMaximumEntries(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError('Resource cache maximumEntries must be a positive integer.');
  }
  return value;
}

function defaultDispose(value) {
  value?.dispose?.();
}

export class RefCountedResourceCache {
  constructor({ maximumEntries = 256, dispose = defaultDispose } = {}) {
    this.maximumEntries = requireMaximumEntries(maximumEntries);
    if (typeof dispose !== 'function') {
      throw new TypeError('Resource cache dispose must be a function.');
    }
    this.dispose = dispose;
    this.entries = new Map();
    this.clock = 0;
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.disposals = 0;
    this.activeLeases = 0;
  }

  createLease(entry) {
    entry.refCount += 1;
    entry.lastAccess = ++this.clock;
    this.activeLeases += 1;
    let released = false;

    return Object.freeze({
      key: entry.key,
      value: entry.value,
      release: () => {
        if (released) return false;
        released = true;
        entry.refCount -= 1;
        this.activeLeases -= 1;
        this.trim();
        return true;
      },
    });
  }

  acquire(key, factory) {
    if (typeof factory !== 'function') {
      throw new TypeError('Resource cache factory must be a function.');
    }
    let entry = this.entries.get(key);
    if (entry) {
      this.hits += 1;
      return this.createLease(entry);
    }

    this.misses += 1;
    const value = factory();
    entry = {
      key,
      value,
      refCount: 0,
      lastAccess: ++this.clock,
    };
    this.entries.set(key, entry);
    const lease = this.createLease(entry);
    this.trim();
    return lease;
  }

  evictEntry(entry) {
    this.entries.delete(entry.key);
    this.dispose(entry.value);
    this.evictions += 1;
    this.disposals += 1;
  }

  trim() {
    const excess = this.entries.size - this.maximumEntries;
    if (excess <= 0) return;

    const candidates = [];
    for (const entry of this.entries.values()) {
      if (entry.refCount === 0) candidates.push(entry);
    }
    if (candidates.length === 0) return;

    candidates.sort((a, b) => a.lastAccess - b.lastAccess);
    const evictCount = Math.min(candidates.length, excess);
    for (let i = 0; i < evictCount; i++) {
      this.evictEntry(candidates[i]);
    }
  }

  clear({ force = false } = {}) {
    for (const entry of [...this.entries.values()]) {
      if (!force && entry.refCount !== 0) continue;
      this.evictEntry(entry);
    }
  }

  get metrics() {
    return Object.freeze({
      entries: this.entries.size,
      maximumEntries: this.maximumEntries,
      activeLeases: this.activeLeases,
      overCapacity: Math.max(0, this.entries.size - this.maximumEntries),
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      disposals: this.disposals,
    });
  }
}
