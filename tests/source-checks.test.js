import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertLocalHtmlAssets,
  assertLocalImportTargets,
  collectLocalHtmlAssets,
  collectRelativeModuleSpecifiers,
} from '../tools/source-checks.js';

test('collects static side-effect export and dynamic relative imports', () => {
  const source = [
    "import './side.js';",
    "import { value } from '../value.js';",
    "export { item } from './item.js';",
    "const lazy = import('./lazy.js');",
    "import thing from 'three';",
  ].join('\n');

  assert.deepEqual(collectRelativeModuleSpecifiers(source), [
    './side.js',
    '../value.js',
    './item.js',
    './lazy.js',
  ]);
});

test('collects local HTML assets without cache query strings', () => {
  const source = [
    '<link rel="stylesheet" href="./styles/main.css?v=1" />',
    '<script src="./src/bootstrap.js?v=1"></script>',
    '<script src="https://example.com/remote.js"></script>',
  ].join('\n');

  assert.deepEqual(collectLocalHtmlAssets(source), [
    './styles/main.css',
    './src/bootstrap.js',
  ]);
});

test('local imports must resolve inside the repository with explicit extensions', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fluffytree-source-check-'));

  try {
    const sourceDirectory = path.join(root, 'src');
    mkdirSync(sourceDirectory);
    const dependency = path.join(sourceDirectory, 'dependency.js');
    const entry = path.join(sourceDirectory, 'entry.js');
    writeFileSync(dependency, 'export const value = 1;\n');
    writeFileSync(entry, "import { value } from './dependency.js';\n");

    assert.doesNotThrow(() => assertLocalImportTargets([entry], root));

    writeFileSync(entry, "import './missing.js';\n");
    assert.throws(
      () => assertLocalImportTargets([entry], root),
      /does not resolve to a file/,
    );

    writeFileSync(entry, "import './dependency';\n");
    assert.throws(
      () => assertLocalImportTargets([entry], root),
      /must include a \.js extension/,
    );

    writeFileSync(entry, "import '../../outside.js';\n");
    assert.throws(
      () => assertLocalImportTargets([entry], root),
      /escapes the repository/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('local HTML assets must resolve inside the repository', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fluffytree-html-check-'));

  try {
    mkdirSync(path.join(root, 'styles'));
    writeFileSync(path.join(root, 'styles', 'main.css'), 'body {}\n');
    const html = path.join(root, 'index.html');
    writeFileSync(html, '<link href="./styles/main.css?v=1" rel="stylesheet" />\n');
    assert.doesNotThrow(() => assertLocalHtmlAssets(html, root));

    writeFileSync(html, '<script src="./src/missing.js"></script>\n');
    assert.throws(
      () => assertLocalHtmlAssets(html, root),
      /does not resolve to a file/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
