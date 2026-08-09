import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { load } from 'js-yaml';
import {
  formatDocumentTitle,
  formatReleaseVersion,
} from '../src/app/release-title.js';

function loadRelease() {
  return load(fs.readFileSync('config/release.yaml', 'utf8'));
}

test('static entrypoint matches the configured release and cache version', () => {
  const release = loadRelease();
  const html = fs.readFileSync('index.html', 'utf8');
  const releaseVersion = formatReleaseVersion(release);
  const assetVersion = releaseVersion.slice(1).replace('+', '-');

  assert.match(html, new RegExp(`<title>${escapeRegex(formatDocumentTitle(release))}</title>`));
  assert.match(html, new RegExp(`styles/main\\.css\\?v=${escapeRegex(assetVersion)}`));
  assert.match(html, new RegExp(`src/main\\.js\\?v=${escapeRegex(assetVersion)}`));
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
