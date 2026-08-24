import assert from 'node:assert/strict';
import test from 'node:test';
import { BoundedLruCache } from '../src/core/bounded-lru-cache.js';

test('getOrCreate caches undefined values without rebuilding them', () => {
  const cache = new BoundedLruCache({ maximumEntries: 2 });
  let builds = 0;
  const factory = () => {
    builds += 1;
    return undefined;
  };

  assert.equal(cache.getOrCreate('empty', factory), undefined);
  assert.equal(cache.getOrCreate('empty', factory), undefined);
  assert.equal(builds, 1);
  assert.equal(cache.metrics.misses, 1);
  assert.equal(cache.metrics.hits, 1);
});

test('explicit cache writes do not create synthetic misses', () => {
  const cache = new BoundedLruCache({ maximumEntries: 2 });

  assert.equal(cache.get('tree'), undefined);
  cache.set('tree', { id: 'tree' });

  assert.equal(cache.metrics.misses, 1);
  assert.equal(cache.metrics.hits, 0);
  assert.equal(cache.get('tree').id, 'tree');
  assert.equal(cache.metrics.hits, 1);
});

test('explicit writes preserve the configured LRU bound', () => {
  const cache = new BoundedLruCache({ maximumEntries: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a');
  cache.set('c', 3);

  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
  assert.equal(cache.metrics.evictions, 1);
});
