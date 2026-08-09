import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PresetVariantStore,
  toPresetId,
} from '../src/ui/preset-variant-store.js';

const STORAGE_KEY = 'fluffytree.tuning.variants.v1';

function createStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));

  return {
    entries,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

test('saved settings round trip and list newest first', () => {
  const store = new PresetVariantStore(createStorage());

  assert.equal(store.save('Old pine', 'bonsaiWindswept', { trunk: { bend: 0.5 } }), true);
  assert.equal(store.save('Maple', 'bonsaiInformal', { trunk: { bend: 0.7 } }), true);

  const names = store.list().map((variant) => variant.name);
  assert.equal(names.length, 2);
  assert.ok(names.includes('Old pine') && names.includes('Maple'));
  assert.equal(store.list()[0].savedAt >= store.list()[1].savedAt, true);
  assert.equal(store.load('Maple').basePresetId, 'bonsaiInformal');
  assert.equal(store.load('Maple').value.trunk.bend, 0.7);
  assert.equal(store.load('missing'), null);
});

test('a loaded value is detached from what is stored', () => {
  const store = new PresetVariantStore(createStorage());
  store.save('Pine', 'bonsaiWindswept', { trunk: { bend: 0.5 } });

  const loaded = store.load('Pine');
  loaded.value.trunk.bend = 9;

  assert.equal(store.load('Pine').value.trunk.bend, 0.5);
});

test('deleting reports whether anything was there', () => {
  const store = new PresetVariantStore(createStorage());
  store.save('Pine', 'bonsaiWindswept', { trunk: {} });

  assert.equal(store.remove('Pine'), true);
  assert.equal(store.remove('Pine'), false);
  assert.deepEqual(store.list(), []);
});

test('corrupt storage reads as empty instead of throwing', () => {
  const storage = createStorage({ [STORAGE_KEY]: 'not json' });
  assert.deepEqual(new PresetVariantStore(storage).list(), []);
});

test('structurally invalid storage cannot crash listing or loading', () => {
  const storage = createStorage({
    [STORAGE_KEY]: JSON.stringify({
      missing: null,
      text: 'old-format',
      invalidValue: {
        basePresetId: 'roundOrchard',
        savedAt: 10,
        value: 'not-a-preset',
      },
      valid: {
        basePresetId: 'roundOrchard',
        savedAt: 'bad-date',
        value: { trunk: { bend: 0.2 } },
      },
    }),
  });
  const store = new PresetVariantStore(storage);

  assert.deepEqual(store.list(), [
    { name: 'valid', basePresetId: 'roundOrchard', savedAt: 0 },
  ]);
  assert.equal(store.load('missing'), null);
  assert.equal(store.load('text'), null);
  assert.equal(store.load('invalidValue'), null);
  assert.equal(store.load('valid').value.trunk.bend, 0.2);
  assert.deepEqual(Object.keys(store.toPresetConfig().presets), ['valid']);
});

test('array storage roots are rejected instead of behaving like variant maps', () => {
  const storage = createStorage({
    [STORAGE_KEY]: JSON.stringify([{ value: { marker: true } }]),
  });
  const store = new PresetVariantStore(storage);

  assert.deepEqual(store.list(), []);
  assert.equal(store.save('Pine', 'test', { trunk: {} }), true);
  assert.equal(store.list().length, 1);
});

test('special object-property names save and remove safely', () => {
  const store = new PresetVariantStore(createStorage());

  assert.equal(store.remove('toString'), false);
  assert.equal(store.save('__proto__', 'test', { marker: true }), true);
  assert.equal(store.load('__proto__').value.marker, true);
  assert.equal(store.remove('__proto__'), true);
  assert.equal(store.load('__proto__'), null);
});

test('a storage that refuses writes falls back to session memory', () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
    removeItem: () => {},
  };
  const store = new PresetVariantStore(storage);

  assert.equal(store.save('Pine', 'test', { marker: 1 }), false);
  assert.equal(store.load('Pine').value.marker, 1);
  assert.equal(store.save('Maple', 'test', { marker: 2 }), false);
  assert.deepEqual(
    store.list().map((variant) => variant.name).sort(),
    ['Maple', 'Pine'],
  );
});

test('explicit memory storage reports session-only writes', () => {
  const entries = new Map();
  const storage = {
    persistent: false,
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
  };
  const store = new PresetVariantStore(storage);

  assert.equal(store.save('Pine', 'test', { marker: true }), false);
  assert.equal(store.load('Pine').value.marker, true);
});

test('exported settings are shaped like the preset configuration file', () => {
  const store = new PresetVariantStore(createStorage());
  store.save('Old pine', 'bonsaiWindswept', { trunk: { bend: 0.5 } });
  store.save('My 2nd maple!', 'bonsaiInformal', { trunk: { bend: 0.7 } });

  const config = store.toPresetConfig();
  assert.deepEqual(Object.keys(config.presets).sort(), ['my2ndMaple', 'oldPine']);
  assert.equal(config.presets.oldPine.trunk.bend, 0.5);
});

test('export keeps variants whose names collapse to the same preset id', () => {
  const store = new PresetVariantStore(createStorage());
  store.save('Old pine', 'bonsaiWindswept', { marker: 'space' });
  store.save('Old-pine', 'bonsaiInformal', { marker: 'hyphen' });
  store.save('Old pine 2', 'bonsaiLiterati', { marker: 'number' });

  const config = store.toPresetConfig();

  assert.deepEqual(Object.keys(config.presets), [
    'oldPine',
    'oldPine2',
    'oldPine22',
  ]);
  assert.deepEqual(
    Object.values(config.presets).map((preset) => preset.marker),
    ['space', 'hyphen', 'number'],
  );
});

test('variant names become usable YAML keys', () => {
  assert.equal(toPresetId('Old pine'), 'oldPine');
  assert.equal(toPresetId('  windswept   juniper '), 'windsweptJuniper');
  assert.equal(toPresetId('Bonsai #3'), 'bonsai3');
  assert.equal(toPresetId('2024 maple'), 'variant2024Maple');
});
