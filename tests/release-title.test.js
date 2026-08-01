import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';

const release = Object.freeze({
  version: '2.0.0',
  build: '20260801.1',
  label: 'branch-led foliage LOD',
});

test('release version includes semantic version and uploaded build', () => {
  assert.equal(formatReleaseVersion(release), 'v2.0.0+20260801.1');
});

test('browser title includes the exact uploaded release version', () => {
  assert.equal(
    formatDocumentTitle(release),
    'Procedural Fluffy Trees v2.0.0+20260801.1 — branch-led foliage LOD',
  );
});

test('overlay title includes the same uploaded release version', () => {
  assert.equal(
    formatOverlayTitle(release),
    'Procedural fluffy trees — branch-led foliage LOD · v2.0.0+20260801.1',
  );
});

test('release configuration rejects missing build identifiers', () => {
  assert.throws(
    () => formatReleaseVersion({ version: '2.0.0' }),
    /release configuration 'build'/,
  );
});
