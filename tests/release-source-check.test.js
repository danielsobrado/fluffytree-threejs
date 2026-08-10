import assert from 'node:assert/strict';
import test from 'node:test';
import { assertReleaseSourceConsistency } from '../tools/release-source-check.js';

const release = Object.freeze({
  version: '2.0.0',
  build: '20260810.1',
  label: 'production static hardening',
});

function indexHtml({ build = release.build, label = release.label } = {}) {
  return [
    `<!doctype html><title>Procedural Fluffy Trees v2.0.0+${build} — ${label}</title>`,
    `<link rel="stylesheet" href="./styles/main.css?v=2.0.0-${build}" />`,
    `<script src="./src/main.js?v=2.0.0-${build}"></script>`,
  ].join('\n');
}

test('release source consistency accepts aligned package HTML and release metadata', () => {
  assert.doesNotThrow(() =>
    assertReleaseSourceConsistency({
      release,
      packageConfig: { version: '2.0.0' },
      indexHtml: indexHtml(),
    }),
  );
});

test('release source consistency rejects package and HTML drift', () => {
  assert.throws(
    () =>
      assertReleaseSourceConsistency({
        release,
        packageConfig: { version: '2.1.0' },
        indexHtml: indexHtml(),
      }),
    /does not match release version/,
  );
  assert.throws(
    () =>
      assertReleaseSourceConsistency({
        release,
        packageConfig: { version: '2.0.0' },
        indexHtml: indexHtml({ build: 'old' }),
      }),
    /index\.html title does not match release|asset cache keys do not match release/,
  );
});
