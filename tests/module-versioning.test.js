import assert from 'node:assert/strict';
import test from 'node:test';
import {
  versionHtmlAssets,
  versionJavaScriptSource,
} from '../tools/module-versioning.js';

test('versions static dynamic and side-effect relative imports', () => {
  const source = [
    "import './side.js';",
    "import { value } from '../value.js';",
    "export { item } from './item.js';",
    "const lazy = import('./lazy.js');",
    "import thing from 'three';",
  ].join('\n');
  const versioned = versionJavaScriptSource(source, '2.0.0-42');

  assert.match(versioned, /\.\/side\.js\?v=2.0.0-42/);
  assert.match(versioned, /\.\.\/value\.js\?v=2.0.0-42/);
  assert.match(versioned, /\.\/item\.js\?v=2.0.0-42/);
  assert.match(versioned, /\.\/lazy\.js\?v=2.0.0-42/);
  assert.match(versioned, /from 'three'/);
});

test('replaces existing asset versions in html', () => {
  const html = [
    '<link rel="stylesheet" href="./styles/main.css?v=old" />',
    '<script type="module" src="./src/main.js?v=old"></script>',
  ].join('\n');
  const versioned = versionHtmlAssets(html, 'new');

  assert.match(versioned, /main\.css\?v=new/);
  assert.match(versioned, /main\.js\?v=new/);
  assert.doesNotMatch(versioned, /v=old/);
});
