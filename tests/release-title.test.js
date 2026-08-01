import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatDocumentTitle,
  formatOverlayTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';

const release = Object.freeze({
  version: '1.7.0',
  build: '20260801.5',
  label: 'volumetric canopy occupancy',
});

test('release version includes semantic version and uploaded build', () => {
  assert.equal(formatReleaseVersion(release), 'v1.7.0+20260801.5');
});

test('browser title includes the exact uploaded release version', () => {
  assert.equal(
    formatDocumentTitle(release),
    'Procedural Fluffy Trees v1.7.0+20260801.5 — volumetric canopy occupancy',
  );
});

test('overlay title includes the same uploaded release version', () => {
  assert.equal(
    formatOverlayTitle(release),
    'Procedural fluffy trees — volumetric canopy occupancy · v1.7.0+20260801.5',
  );
});

test('release configuration rejects missing build identifiers', () => {
  assert.throws(
    () => formatReleaseVersion({ version: '1.7.0' }),
    /release configuration 'build'/,
  );
});
