import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { load } from 'js-yaml';
import { validateSceneConfig } from '../src/config/scene-config-validator.js';

function loadSceneConfig() {
  return load(fs.readFileSync('config/scene.yaml', 'utf8'));
}

test('the shipped scene configuration is valid', () => {
  const config = loadSceneConfig();
  assert.equal(validateSceneConfig(config), config);
});

test('scene validation rejects unordered LOD thresholds', () => {
  const config = loadSceneConfig();
  config.lod.farPixels = config.lod.mediumPixels + 1;

  assert.throws(
    () => validateSceneConfig(config),
    /nearPixels > mediumPixels > farPixels > cullPixels/,
  );
});

test('scene validation rejects non-finite layout coordinates', () => {
  const config = loadSceneConfig();
  config.layout[0].position[1] = Number.POSITIVE_INFINITY;

  assert.throws(
    () => validateSceneConfig(config),
    /layout\[0\]\.position.*finite numbers/,
  );
});

test('scene validation rejects numeric strings instead of silently coercing them', () => {
  const config = loadSceneConfig();
  config.lod.farPixels = '35';

  assert.throws(
    () => validateSceneConfig(config),
    /lod\.farPixels.*finite number/,
  );
});

test('scene validation rejects invalid camera clipping planes', () => {
  const config = loadSceneConfig();
  config.camera.far = config.camera.near;

  assert.throws(
    () => validateSceneConfig(config),
    /camera\.far.*greater than.*camera\.near/,
  );
});

test('scene validation rejects a camera placed exactly on its target', () => {
  const config = loadSceneConfig();
  config.camera.position = [...config.camera.target];

  assert.throws(
    () => validateSceneConfig(config),
    /camera\.position.*differ from.*camera\.target/,
  );
});

test('scene validation rejects max orbit distance below its runtime minimum', () => {
  const config = loadSceneConfig();
  config.camera.controlsMaxDistance = 6.99;

  assert.throws(
    () => validateSceneConfig(config),
    /camera\.controlsMaxDistance.*>= 7/,
  );
});

test('scene validation rejects a zero sun direction', () => {
  const config = loadSceneConfig();
  config.lighting.sunPosition = [0, 0, 0];

  assert.throws(
    () => validateSceneConfig(config),
    /lighting\.sunPosition.*zero vector/,
  );
});

test('scene validation rejects seeds that would truncate or wrap', () => {
  for (const seed of [-1, 1.5, 0x100000000]) {
    const config = loadSceneConfig();
    config.layout[0].seed = seed;

    assert.throws(
      () => validateSceneConfig(config),
      /layout\[0\]\.seed.*(?:>= 0|<= 4294967295|unsigned 32-bit integer)/,
      String(seed),
    );
  }
});

test('scene validation rejects malformed colors', () => {
  const config = loadSceneConfig();
  config.lighting.sunColor = 'sunny';

  assert.throws(
    () => validateSceneConfig(config),
    /lighting\.sunColor.*#RRGGBB color/,
  );
});
