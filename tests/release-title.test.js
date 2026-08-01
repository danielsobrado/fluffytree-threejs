import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';

const release = Object.freeze({
  version: '1.6.0',
  build: '20260801.4',
  label: 'canopy closure + seamless trunk',
});

test('release version includes semantic version and uploaded build', () => {
  assert.equal(formatReleaseVersion(release), 'v1.6.0+20260801.4');
});

test('browser title includes the exact uploaded release version', () => {
  assert.equal(
    formatDocumentTitle(release),
    'Procedural Fluffy Trees v1.6.0+20260801.4 — canopy closure + seamless trunk',
  );
});

test('overlay title includes the same uploaded release version', () => {
  assert.equal(
    formatOverlayTitle(release),
    'Procedural fluffy trees — canopy closure + seamless trunk · v1.6.0+20260801.4',
  );
});

test('release configuration rejects missing build identifiers', () => {
  assert.throws(
    () => formatReleaseVersion({ version: '1.6.0' }),
    /release configuration 'build'/,
  );
});
