import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertLocalHtmlAssets,
  assertLocalImportSpecifiers,
  collectLocalHtmlAssets,
} from '../tools/source-checks.js';

const IMPORT_CHECKER = path.resolve('tools/check-module-imports.js');

function runImportChecker(repositoryRoot, files, returnDependencies = false) {
  return spawnSync(
    process.execPath,
    ['--no-warnings', '--experimental-vm-modules', IMPORT_CHECKER],
    {
      encoding: 'utf8',
      input: JSON.stringify({ repositoryRoot, files, returnDependencies }),
    },
  );
}

test('collects active local HTML assets without cache query strings', () => {
  const source = [
    '<!-- <script src="./src/retired.js"></script> -->',
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

    assert.doesNotThrow(() =>
      assertLocalImportSpecifiers(entry, ['./dependency.js'], root),
    );
    assert.throws(
      () => assertLocalImportSpecifiers(entry, ['./missing.js'], root),
      /does not resolve to a file/,
    );
    assert.throws(
      () => assertLocalImportSpecifiers(entry, ['./dependency'], root),
      /must include a \.js extension/,
    );
    assert.throws(
      () => assertLocalImportSpecifiers(entry, ['../../outside.js'], root),
      /escapes the repository/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('module parser ignores comments, validates imports, and can return dependencies', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fluffytree-module-parser-'));

  try {
    const sourceDirectory = path.join(root, 'src');
    mkdirSync(sourceDirectory);
    const dependency = path.join(sourceDirectory, 'dependency.js');
    const entry = path.join(sourceDirectory, 'entry.js');
    writeFileSync(dependency, 'export const value = 1;\n');
    writeFileSync(
      entry,
      [
        "// import './missing.js';",
        "/* export { old } from './also-missing.js'; */",
        "import { value } from './dependency.js';",
        "export { value as exported } from './dependency.js';",
      ].join('\n'),
    );

    const valid = runImportChecker(root, [entry], true);
    assert.equal(valid.status, 0, valid.stderr);
    const dependencies = JSON.parse(valid.stdout);
    // Node >= 22 deduplicates SourceTextModule.dependencySpecifiers, so an
    // import and a re-export from the same module may yield one or two entries.
    const deps = dependencies[entry];
    assert.ok(Array.isArray(deps), 'dependencies should be an array');
    assert.ok(
      deps.length === 1 || deps.length === 2,
      `expected 1 or 2 dependency entries, got ${deps.length}`,
    );
    assert.ok(
      deps.every((d) => d === './dependency.js'),
      'all entries should be ./dependency.js',
    );

    writeFileSync(entry, "import './missing.js';\n");
    const invalid = runImportChecker(root, [entry]);
    assert.notEqual(invalid.status, 0);
    assert.match(invalid.stderr, /does not resolve to a file/);
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
    writeFileSync(
      html,
      [
        '<!-- <script src="./src/retired.js"></script> -->',
        '<link href="./styles/main.css?v=1" rel="stylesheet" />',
      ].join('\n'),
    );
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
