import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  assertLocalImportTargets,
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
