import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePagesConfig } from '../tools/pages-config.js';

function validConfig(overrides = {}) {
  return {
    remote: 'origin',
    sourceBranch: 'main',
    publishBranch: 'gh-pages',
    requiredFiles: ['index.html', 'config/release.yaml', '.nojekyll'],
    ...overrides,
  };
}

test('normalizes a valid Pages configuration', () => {
  assert.deepEqual(parsePagesConfig(validConfig()), validConfig());
});

test('source and publish branches cannot be the same', () => {
  assert.throws(
    () => parsePagesConfig(validConfig({ publishBranch: 'main' })),
    /must be different branches/,
  );
});

test('required files must stay inside the repository', () => {
  for (const file of ['../index.html', '/index.html', 'config/../index.html', 'config\\release.yaml']) {
    assert.throws(
      () => parsePagesConfig(validConfig({ requiredFiles: [file] })),
      /repository-relative|stay inside the repository/,
    );
  }
});

test('duplicate required files are rejected', () => {
  assert.throws(
    () =>
      parsePagesConfig(
        validConfig({ requiredFiles: ['index.html', 'index.html'] }),
      ),
    /duplicate paths/,
  );
});

test('remote must be a safe configured remote name', () => {
  for (const remote of ['--upload-pack=bad', 'origin other', '../origin']) {
    assert.throws(
      () => parsePagesConfig(validConfig({ remote })),
      /Git remote name/,
    );
  }
});
