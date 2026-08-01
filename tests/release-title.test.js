import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';

const release = Object.freeze({
  version: '1.4.0',
  build: '20260801.1',
  label: 'leaf detail',
});

test('release version includes semantic version and uploaded build', () => {
  assert.equal(formatReleaseVersion(release), 'v1.4.0+20260801.1');
});

test('browser title includes the exact uploaded release version', () => {
  assert.equal(
    formatDocumentTitle(release),
    'Procedural Fluffy Trees v1.4.0+20260801.1 — leaf detail',
  );
});

test('overlay title includes the same uploaded release version', () => {
  assert.equal(
    formatOverlayTitle(release),
    'Procedural fluffy trees — leaf detail · v1.4.0+20260801.1',
  );
});

test('release configuration rejects missing build identifiers', () => {
  assert.throws(
    () => formatReleaseVersion({ version: '1.4.0' }),
    /release configuration 'build'/,
  );
});
