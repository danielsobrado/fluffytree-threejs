import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { CrownLobeTreeGenerator } from '../src/generation/crown-lobe-tree-generator.js';
import {
  DEFAULT_TREE_GENERATION_MODEL,
  resolveTreeGenerationModelId,
} from '../src/generation/tree-generation-model.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

function createPresetValue(overrides = {}) {
  const preset = createTestPreset();
  return structuredClone({
    label: 'Test',
    height: preset.height,
    crown: preset.crown,
    trunk: preset.trunk,
    foliage: preset.foliage,
    ...overrides,
  });
}

test('tree presets default to the crown-lobe generation model', () => {
  const library = PresetLibrary.fromConfig({
    presets: { test: createPresetValue() },
  });

  assert.equal(library.get('test').generationModel, DEFAULT_TREE_GENERATION_MODEL);
});

test('tree generation model survives preset config round trips', () => {
  const library = PresetLibrary.fromConfig({
    presets: {
      test: createPresetValue({ generationModel: 'custom-botanical-model' }),
    },
  });

  const restored = PresetLibrary.fromConfig(library.toConfig());
  assert.equal(restored.get('test').generationModel, 'custom-botanical-model');
});

test('tree generation model ids are normalized and validated', () => {
  assert.equal(resolveTreeGenerationModelId('  custom  '), 'custom');
  assert.throws(
    () => resolveTreeGenerationModelId('   ', 'test.generationModel'),
    /test\.generationModel/,
  );
});

test('tree generator dispatches presets to registered generation models', () => {
  const calls = [];
  const baseGenerator = new CrownLobeTreeGenerator();
  const customGenerator = {
    generate(preset, seed, options) {
      calls.push({ preset, seed, options });
      return baseGenerator.generate(preset, seed, options);
    },
  };
  const generator = new TreeGenerator({
    modelGenerators: { synthetic: customGenerator },
  });
  const preset = createTestPreset({
    root: { generationModel: 'synthetic' },
  });
  const options = Object.freeze({ includeSurfaceSamples: false });

  const ir = generator.generateIr(preset, 42, options);

  assert.equal(ir.presetId, 'test');
  assert.equal(ir.generationModel, 'synthetic');
  assert.deepEqual(calls, [{ preset, seed: 42, options }]);
});

test('tree generator rejects a model returning IR for another model id', () => {
  const generator = new TreeGenerator();
  const preset = createTestPreset({
    root: { generationModel: 'synthetic' },
  });
  const mismatched = {
    generate() {
      return new CrownLobeTreeGenerator().generate(
        createTestPreset(),
        1,
        { includeSurfaceSamples: false },
      );
    },
  };
  generator.register('synthetic', mismatched);

  assert.throws(
    () => generator.generateIr(preset, 1),
    /returned IR for 'crown-lobe'/,
  );
});

test('tree generator rejects unsupported generation models', () => {
  const generator = new TreeGenerator();

  assert.throws(
    () => generator.generate({ id: 'test', generationModel: 'missing' }, 1),
    /Unsupported tree generation model 'missing'/,
  );
});

test('tree generator rejects invalid generation model implementations', () => {
  assert.throws(
    () => new TreeGenerator({ modelGenerators: { broken: {} } }),
    /must provide a generate\(\) function/,
  );
});
