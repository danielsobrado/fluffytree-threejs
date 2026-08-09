import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { load } from 'js-yaml';
import { createValidatedTreePresetMap } from '../src/domain/validated-tree-preset-map.js';

function loadTreeConfig() {
  return load(fs.readFileSync('config/tree-presets.yaml', 'utf8'));
}

test('validated preset map accepts the shipped tree configuration', () => {
  const config = loadTreeConfig();
  const presets = createValidatedTreePresetMap(config);

  assert.equal(presets.size, Object.keys(config.presets).length);
});

test('validated preset map rejects numeric strings', () => {
  const config = loadTreeConfig();
  config.presets.roundOrchard.height = '6.9';

  assert.throws(
    () => createValidatedTreePresetMap(config),
    /roundOrchard\.height.*finite number/,
  );
});

test('validated preset map rejects array preset roots', () => {
  assert.throws(
    () => createValidatedTreePresetMap({ presets: [] }),
    /must define a 'presets' object/,
  );
});
