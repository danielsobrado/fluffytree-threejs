import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

function createValue(overrides = {}) {
  // The fixture builds a validated preset; the library needs the plain shape it
  // came from, which is what an editor round-trips.
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

test('a library validates on construction and exposes both shapes of a preset', () => {
  const library = PresetLibrary.fromConfig({ presets: { test: createValue() } });

  assert.deepEqual(library.ids, ['test']);
  assert.equal(library.has('test'), true);
  assert.equal(library.get('test').id, 'test');
  assert.equal(library.rawValue('test').crown.profile, 'round');
});

test('raw values are detached, so an editor cannot mutate the live preset', () => {
  const library = PresetLibrary.fromConfig({ presets: { test: createValue() } });
  const value = library.rawValue('test');

  value.trunk.baseRadius = 0.9;
  value.crown.lean[0] = 5;

  assert.notEqual(library.get('test').trunk.baseRadius, 0.9);
  assert.notEqual(library.rawValue('test').crown.lean[0], 5);
});

test('an invalid edit is rejected and leaves the library on the previous preset', () => {
  const library = PresetLibrary.fromConfig({ presets: { test: createValue() } });
  const before = library.get('test');
  const broken = library.rawValue('test');
  broken.trunk.branching.gnarl = 4;

  assert.throws(() => library.set('test', broken), /trunk\.branching\.gnarl/);
  assert.equal(library.get('test'), before);
  assert.equal(library.rawValue('test').trunk.branching.gnarl, 0.22);
});

test('a valid edit replaces the preset and survives a config round trip', () => {
  const library = PresetLibrary.fromConfig({ presets: { test: createValue() } });
  const edited = library.rawValue('test');
  edited.trunk.style = 'slant';
  edited.trunk.sweep = 0;
  edited.trunk.movement = 1.4;
  edited.foliage.leafShape = 'maple';
  library.set('test', edited);

  assert.equal(library.get('test').trunk.style, 'slant');

  const restored = PresetLibrary.fromConfig(library.toConfig());
  assert.equal(restored.get('test').trunk.style, 'slant');
  assert.equal(restored.get('test').foliage.leafShape, 'maple');
  // A leaning style carries the crown to its own apex.
  assert.ok(restored.get('test').crown.anchor.x > 0.1);
  assert.ok(Math.abs(restored.get('test').crown.anchor.z) < 1e-12);
});

test('an upright style leaves the crown over the roots', () => {
  const library = PresetLibrary.fromConfig({ presets: { test: createValue() } });
  const edited = library.rawValue('test');
  edited.trunk.style = 'informalUpright';
  library.set('test', edited);

  assert.ok(Math.abs(library.get('test').crown.anchor.x) < 1e-12);
  assert.ok(Math.abs(library.get('test').crown.anchor.z) < 1e-12);
});

test('presets can be added and removed', () => {
  const library = PresetLibrary.fromConfig({ presets: { test: createValue() } });
  library.set('copy', createValue({ label: 'Copy' }));

  assert.deepEqual(library.ids, ['test', 'copy']);
  assert.deepEqual(Object.keys(library.toConfig(['copy']).presets), ['copy']);

  library.remove('test');
  assert.deepEqual(library.ids, ['copy']);
  assert.throws(() => library.rawValue('test'), /Unknown tree preset/);
});

test('a configuration without presets is rejected', () => {
  assert.throws(() => PresetLibrary.fromConfig({}), /presets/);
  assert.throws(() => PresetLibrary.fromConfig(null), /presets/);
});
