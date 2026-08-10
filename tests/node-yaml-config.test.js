import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  readYamlConfig,
  readYamlConfigSync,
} from '../tools/node-yaml-config.js';

test('Node YAML loaders accept mapping documents', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fluffytree-yaml-'));
  const file = path.join(root, 'config.yaml');

  try {
    writeFileSync(file, 'value: 42\n');
    assert.deepEqual(readYamlConfigSync(file), { value: 42 });
    assert.deepEqual(await readYamlConfig(file), { value: 42 });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Node YAML loaders reject arrays and malformed YAML with source context', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'fluffytree-yaml-'));
  const file = path.join(root, 'config.yaml');

  try {
    writeFileSync(file, '- first\n- second\n');
    assert.throws(() => readYamlConfigSync(file), /must contain a YAML object/);
    await assert.rejects(readYamlConfig(file), /must contain a YAML object/);

    writeFileSync(file, 'value: [\n');
    assert.throws(() => readYamlConfigSync(file), /Failed to parse YAML configuration/);
    await assert.rejects(readYamlConfig(file), /Failed to parse YAML configuration/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Node YAML loaders wrap read failures with the requested path', async () => {
  const file = path.join(os.tmpdir(), 'fluffytree-missing-config.yaml');

  assert.throws(() => readYamlConfigSync(file), /Failed to read YAML configuration/);
  await assert.rejects(readYamlConfig(file), /Failed to read YAML configuration/);
});
