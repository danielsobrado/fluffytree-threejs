import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const config = readYamlConfigSync(
  new URL('../config/advanced-broadleaf-presets.yaml', import.meta.url),
);
const library = PresetLibrary.fromConfig(config);

test('native broadleaf species keep distinct configured leaf silhouettes', () => {
  const oak = library.get('spreadingOak');
  const umbrella = library.get('umbrellaBroadleaf');

  assert.equal(oak.foliage.leafShape, 'broadleaf');
  assert.equal(umbrella.foliage.leafShape, 'oval');

  const generator = new TreeGenerator();
  const oakIr = generator.generateIr(oak, 401111);
  const umbrellaIr = generator.generateIr(umbrella, 401111);

  assert.equal(oakIr.metadata.material.leafShape, 'broadleaf');
  assert.equal(umbrellaIr.metadata.material.leafShape, 'oval');
});

test('native broadleaf preset rejects unsupported leaf silhouettes', () => {
  const invalid = structuredClone(config);
  invalid.presets.spreadingOak.foliage.leafShape = 'imaginary-leaf';

  assert.throws(
    () => PresetLibrary.fromConfig(invalid),
    /unsupported leaf shape 'imaginary-leaf'/,
  );
});
