import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

function rawPreset(label) {
  const preset = createTestPreset();
  return structuredClone({
    label,
    height: preset.height,
    crown: preset.crown,
    trunk: preset.trunk,
    foliage: preset.foliage,
  });
}

test('preset library combines independent config packs without changing order', () => {
  const library = PresetLibrary.fromConfigs([
    { presets: { first: rawPreset('First') } },
    { presets: { second: rawPreset('Second') } },
  ]);

  assert.deepEqual(library.ids, ['first', 'second']);
});

test('preset library rejects duplicate ids across config packs', () => {
  assert.throws(
    () =>
      PresetLibrary.fromConfigs([
        { presets: { duplicate: rawPreset('First') } },
        { presets: { duplicate: rawPreset('Second') } },
      ]),
    /Duplicate tree preset 'duplicate'/,
  );
});

test('preset library preserves model-specific morphology as frozen data', () => {
  const value = rawPreset('Morphology');
  value.generationModel = 'custom';
  value.morphology = { growth: { strength: 0.7 } };
  const library = PresetLibrary.fromConfig({ presets: { test: value } });

  assert.deepEqual(library.get('test').morphology, value.morphology);
  assert.equal(Object.isFrozen(library.get('test').morphology.growth), true);
});
