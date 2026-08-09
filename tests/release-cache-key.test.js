import assert from 'node:assert/strict';
import test from 'node:test';
import { releaseCacheKeyFromYaml } from '../tools/release-cache-key.js';

test('release cache key combines trimmed version and build values', () => {
  assert.equal(
    releaseCacheKeyFromYaml("version: '2.0.0'\nbuild: ' 20260809.6 '\n"),
    '2.0.0-20260809.6',
  );
});

test('release cache key rejects incomplete or malformed release documents', () => {
  assert.throws(() => releaseCacheKeyFromYaml('[]'), /YAML object/);
  assert.throws(
    () => releaseCacheKeyFromYaml("version: '2.0.0'\nbuild: ''\n"),
    /build/,
  );
});
