import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertNoRelativeDynamicImports,
  versionHtmlAssets,
  versionJavaScriptSource,
} from '../tools/module-versioning.js';

test('versions parser-confirmed static relative imports only', () => {
  const source = [
    "// import './side.js';",
    "const example = \"import './side.js'\";",
    "import './side.js';",
    "import { value } from '../value.js';",
    "export { item } from './item.js';",
    "import thing from 'three';",
  ].join('\n');
  const versioned = versionJavaScriptSource(
    source,
    '2.0.0-42',
    ['./side.js', '../value.js', './item.js', 'three'],
    'example.js',
  );

  assert.match(versioned, /import '\.\/side\.js\?v=2.0.0-42'/);
  assert.match(versioned, /\.\.\/value\.js\?v=2.0.0-42/);
  assert.match(versioned, /\.\/item\.js\?v=2.0.0-42/);
  assert.match(versioned, /from 'three'/);
  assert.match(versioned, /\/\/ import '\.\/side\.js';/);
  assert.match(versioned, /example = "import '\.\/side\.js'"/);
});

test('preserves existing module query parameters while replacing the cache key', () => {
  const source = "import './side.js?mode=qa&v=old#fragment';";
  const versioned = versionJavaScriptSource(
    source,
    'new',
    ['./side.js?mode=qa&v=old#fragment'],
  );

  assert.equal(
    versioned,
    "import './side.js?mode=qa&v=new#fragment';",
  );
});

test('relative dynamic browser imports are rejected instead of published unstamped', () => {
  assert.throws(
    () => assertNoRelativeDynamicImports("const lazy = import('./lazy.js');", 'app.js'),
    /cannot be cache-versioned safely/,
  );

  assert.doesNotThrow(() =>
    assertNoRelativeDynamicImports(
      "const example = \"import('./lazy.js')\"; // import('./other.js')",
      'app.js',
    ),
  );
});

test('replaces existing asset versions in html without touching commented tags', () => {
  const html = [
    '<!-- <script src="./src/old.js?v=old"></script> -->',
    '<link rel="stylesheet" href="./styles/main.css?v=old" />',
    '<script type="module" src="./src/main.js?v=old"></script>',
  ].join('\n');
  const versioned = versionHtmlAssets(html, 'new');

  assert.match(versioned, /main\.css\?v=new/);
  assert.match(versioned, /main\.js\?v=new/);
  assert.match(versioned, /old\.js\?v=old/);
});
