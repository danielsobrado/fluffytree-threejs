import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { load } from 'js-yaml';
import { PresetLibrary } from '../src/domain/preset-library.js';

function loadTreeConfig() {
  return load(fs.readFileSync('config/tree-presets.yaml', 'utf8'));
}

function mutateRoundOrchard(mutator) {
  const config = loadTreeConfig();
  mutator(config.presets.roundOrchard);
  return config;
}

test('the shipped tree preset configuration is valid', () => {
  const config = loadTreeConfig();
  const library = PresetLibrary.fromConfig(config);

  assert.equal(library.ids.length, Object.keys(config.presets).length);
});

test('tree preset validation rejects numeric strings instead of coercing them', () => {
  const config = mutateRoundOrchard((preset) => {
    preset.height = '6.9';
  });

  assert.throws(
    () => PresetLibrary.fromConfig(config),
    /roundOrchard\.height.*finite number/,
  );
});

test('tree preset validation rejects coercible nested tuning values', () => {
  const config = mutateRoundOrchard((preset) => {
    preset.foliage.shell.alphaTest = '0.46';
  });

  assert.throws(
    () => PresetLibrary.fromConfig(config),
    /roundOrchard\.foliage\.shell\.alphaTest.*finite number/,
  );
});

test('tree preset validation rejects non-finite pair values', () => {
  const config = mutateRoundOrchard((preset) => {
    preset.crown.lobeScale = [0.74, Number.POSITIVE_INFINITY];
  });

  assert.throws(
    () => PresetLibrary.fromConfig(config),
    /roundOrchard\.crown\.lobeScale.*finite number/,
  );
});

test('tree preset validation rejects fractional structural counts', () => {
  const config = mutateRoundOrchard((preset) => {
    preset.trunk.branching.childCount = [1, 1.5];
  });

  assert.throws(
    () => PresetLibrary.fromConfig(config),
    /roundOrchard\.trunk\.branching\.childCount.*integers/,
  );
});

test('tree preset validation rejects a trunk that grows toward its tip', () => {
  const config = mutateRoundOrchard((preset) => {
    preset.trunk.topRadius = preset.trunk.baseRadius + 0.01;
  });

  assert.throws(
    () => PresetLibrary.fromConfig(config),
    /topRadius.*must not exceed.*baseRadius/,
  );
});

test('tree preset validation rejects empty palette colors', () => {
  const config = mutateRoundOrchard((preset) => {
    preset.foliage.palette[1] = '   ';
  });

  assert.throws(
    () => PresetLibrary.fromConfig(config),
    /roundOrchard\.foliage\.palette.*non-empty string/,
  );
});

test('preset library rejects non-object and empty preset collections', () => {
  assert.throws(
    () => PresetLibrary.fromConfig({ presets: [] }),
    /must define a 'presets' object/,
  );
  assert.throws(
    () => PresetLibrary.fromConfig({ presets: {} }),
    /presets.*must not be empty/,
  );
});
