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

  assert.ok(html.includes(`<title>${formatDocumentTitle(release)}</title>`));
  assert.ok(html.includes(`styles/main.css?v=${assetVersion}`));
  assert.ok(html.includes(`src/bootstrap-fallback.js?v=${assetVersion}`));
  assert.ok(html.includes(`src/main.js?v=${assetVersion}`));
});
