import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CachedTreeGenerator,
  calculateTreeGenerationCacheCapacity,
} from '../src/generation/cached-tree-generator.js';

function createGenerator() {
  const calls = [];
  return {
    calls,
    generate(preset, seed, options) {
      const value = Object.freeze({
        presetId: preset.id,
        seed,
        includeSurfaceSamples: options.includeSurfaceSamples !== false,
        call: calls.length + 1,
      });
      calls.push({ preset, seed, options });
      return value;
    },
  };
}

test('repeated variants reuse generated tree data', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });
  const preset = { id: 'oak' };
  const options = { includeSurfaceSamples: true };

  const first = cache.generate(preset, 17, options);
  const second = cache.generate(preset, 17, options);

  assert.equal(second, first);
  assert.equal(generator.calls.length, 1);
  assert.equal(cache.metrics.hits, 1);
  assert.equal(cache.metrics.misses, 1);
});

test('worker generated tree data primes the cache without synchronous generation', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });
  const preset = { id: 'oak' };
  const treeData = Object.freeze({ presetId: 'oak', seed: 19 });

  cache.prime(preset, 19, { includeSurfaceSamples: true }, treeData);
  const generated = cache.generate(preset, 19, { includeSurfaceSamples: false });

  assert.equal(generated, treeData);
  assert.equal(generator.calls.length, 0);
  assert.equal(cache.metrics.hits, 1);
  assert.equal(cache.metrics.misses, 0);
});

test('cache presence lookup is side-effect free and honors full-to-compact reuse', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });
  const preset = { id: 'oak' };

  assert.equal(cache.hasCached(preset, 21, { includeSurfaceSamples: true }), false);
  cache.generate(preset, 21, { includeSurfaceSamples: true });
  const metrics = cache.metrics;

  assert.equal(cache.hasCached(preset, 21, { includeSurfaceSamples: true }), true);
  assert.equal(cache.hasCached(preset, 21, { includeSurfaceSamples: false }), true);
  assert.equal(cache.metrics.hits, metrics.hits);
  assert.equal(cache.metrics.misses, metrics.misses);
});

test('full tree data can satisfy a compact forest request', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });
  const preset = { id: 'oak' };
  const full = cache.generate(preset, 23, {});
  const compact = cache.generate(preset, 23, { includeSurfaceSamples: false });

  assert.equal(compact, full);
  assert.equal(generator.calls.length, 1);
});

test('full tree data replaces the compact entry for the same variant', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });
  const preset = { id: 'oak' };

  const compact = cache.generate(preset, 27, { includeSurfaceSamples: false });
  const full = cache.generate(preset, 27, { includeSurfaceSamples: true });
  const compactAfterUpgrade = cache.generate(preset, 27, {
    includeSurfaceSamples: false,
  });

  assert.notEqual(full, compact);
  assert.equal(full.includeSurfaceSamples, true);
  assert.equal(compactAfterUpgrade, full);
  assert.equal(generator.calls.length, 2);
  assert.equal(cache.metrics.size, 1);
});

test('upgrading a compact variant does not evict another cached variant', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 2 });
  const preset = { id: 'oak' };

  const other = cache.generate(preset, 41, { includeSurfaceSamples: true });
  cache.generate(preset, 42, { includeSurfaceSamples: false });
  cache.generate(preset, 42, { includeSurfaceSamples: true });
  const otherAgain = cache.generate(preset, 41, { includeSurfaceSamples: true });

  assert.equal(otherAgain, other);
  assert.equal(generator.calls.length, 3);
  assert.equal(cache.metrics.size, 2);
  assert.equal(cache.metrics.evictions, 0);
});

test('preset object identity prevents stale data crossing preset revisions', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });

  cache.generate({ id: 'oak', palette: 'summer' }, 31, {
    includeSurfaceSamples: true,
  });
  cache.generate({ id: 'oak', palette: 'autumn' }, 31, {
    includeSurfaceSamples: true,
  });

  assert.equal(generator.calls.length, 2);
});

test('the cache evicts least-recently-used entries at its configured bound', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 2 });
  const preset = { id: 'oak' };
  const options = { includeSurfaceSamples: true };

  cache.generate(preset, 1, options);
  cache.generate(preset, 2, options);
  cache.generate(preset, 1, options);
  cache.generate(preset, 3, options);
  cache.generate(preset, 2, options);

  assert.equal(generator.calls.length, 4);
  assert.equal(cache.metrics.size, 2);
  assert.equal(cache.metrics.evictions, 2);
});

test('cache rejects seeds the wrapped generator would reject', () => {
  const generator = createGenerator();
  const cache = new CachedTreeGenerator({ generator, maximumEntries: 4 });
  const preset = { id: 'oak' };

  for (const seed of [-1, 0x100000000, Number.NaN, '7']) {
    assert.throws(() => cache.generate(preset, seed), /seed/i);
  }

  assert.equal(generator.calls.length, 0);
});

test('cache capacity holds one generated entry per forest variant', () => {
  assert.equal(calculateTreeGenerationCacheCapacity(12, 8), 96);
  assert.throws(() => calculateTreeGenerationCacheCapacity(0, 8), /positive integer/);
});
