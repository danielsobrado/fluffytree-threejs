import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeGenerationWorkerUrl } from '../src/workers/tree-generation-worker-factory.js';

test('tree generation worker inherits the module cache version', () => {
  const url = createTreeGenerationWorkerUrl(
    'https://example.test/src/workers/tree-generation-worker-factory.js?v=release-7',
  );

  assert.equal(
    url.href,
    'https://example.test/src/workers/tree-generation-worker.js?v=release-7',
  );
});

test('tree generation worker URL stays clean without a cache query', () => {
  const url = createTreeGenerationWorkerUrl(
    'http://localhost:8000/src/workers/tree-generation-worker-factory.js',
  );

  assert.equal(
    url.href,
    'http://localhost:8000/src/workers/tree-generation-worker.js',
  );
});
