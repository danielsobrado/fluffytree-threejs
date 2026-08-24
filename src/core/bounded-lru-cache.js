function requireMaximumEntries(value) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError('Cache maximumEntries must be a positive integer.');
  }
  return value;
}

export class BoundedLruCache {
  constructor({ maximumEntries = 128 } = {}) {
    this.maximumEntries = requireMaximumEntries(maximumEntries);
    this.entries = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  touch(key, value) {
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  get(key) {
    if (!this.entries.has(key)) {
      this.misses += 1;
      return undefined;
    }
    this.hits += 1;
    return this.touch(key, this.entries.get(key));
  }

  set(key, value) {
    this.touch(key, value);
    this.trim();
    return value;
  }

  getOrCreate(key, factory) {
    if (typeof factory !== 'function') {
      throw new TypeError('Cache factory must be a function.');
    }
    if (this.entries.has(key)) {
      this.hits += 1;
      return this.touch(key, this.entries.get(key));
    }

    this.misses += 1;
    return this.set(key, factory());
  }

  trim() {
    while (this.entries.size > this.maximumEntries) {
      const oldest = this.entries.keys().next().value;
      this.entries.delete(oldest);
      this.evictions += 1;
    }
  }

  clear() {
    this.entries.clear();
  }

  get metrics() {
    return Object.freeze({
      entries: this.entries.size,
      maximumEntries: this.maximumEntries,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
    });
  }
}
