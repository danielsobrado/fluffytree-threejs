import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedLruCache } from '../src/core/bounded-lru-cache.js';
import { RefCountedResourceCache } from '../src/core/ref-counted-resource-cache.js';

test('bounded LRU cache reuses values and evicts the least recently used entry', () => {
  const cache = new BoundedLruCache({ maximumEntries: 2 });
  let builds = 0;
  const build = (value) => () => {
    builds += 1;
    return value;
  };

  assert.equal(cache.getOrCreate('a', build(1)), 1);
  assert.equal(cache.getOrCreate('b', build(2)), 2);
  assert.equal(cache.getOrCreate('a', build(9)), 1);
  assert.equal(cache.getOrCreate('c', build(3)), 3);
  assert.equal(cache.get('b'), undefined);
  assert.equal(builds, 3);
  assert.equal(cache.metrics.hits, 1);
  assert.equal(cache.metrics.evictions, 1);
});

test('ref-counted resource cache never evicts a leased resource', () => {
  const disposed = [];
  const cache = new RefCountedResourceCache({
    maximumEntries: 1,
    dispose: (value) => disposed.push(value.id),
  });
  const first = cache.acquire('a', () => ({ id: 'a' }));
  const second = cache.acquire('b', () => ({ id: 'b' }));

  assert.equal(cache.metrics.overCapacity, 1);
  assert.deepEqual(disposed, []);
  assert.equal(first.release(), true);
  assert.deepEqual(disposed, ['a']);
  assert.equal(cache.metrics.entries, 1);
  assert.equal(second.release(), true);
  assert.equal(second.release(), false);
});

test('ref-counted resource cache exposes cache hits and disposes on force clear', () => {
  const disposed = [];
  const cache = new RefCountedResourceCache({
    maximumEntries: 2,
    dispose: (value) => disposed.push(value.id),
  });
  const first = cache.acquire('same', () => ({ id: 'value' }));
  const second = cache.acquire('same', () => ({ id: 'unexpected' }));

  assert.equal(first.value, second.value);
  assert.equal(cache.metrics.hits, 1);
  first.release();
  second.release();
  cache.clear({ force: true });
  assert.deepEqual(disposed, ['value']);
});
