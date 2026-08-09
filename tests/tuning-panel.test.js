import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TuningPanel } from '../src/ui/tuning-panel.js';
import { TUNING_GROUPS } from '../src/ui/tuning-schema.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

function createValue(label) {
  const preset = createTestPreset();

  return structuredClone({
    label,
    height: preset.height,
    crown: preset.crown,
    trunk: preset.trunk,
    foliage: preset.foliage,
  });
}

function createPanel() {
  const library = PresetLibrary.fromConfig({
    presets: {
      first: createValue('First'),
      second: createValue('Second'),
    },
  });
  const rebuilds = [];
  const demo = {
    rebuildPreset: (presetId) => rebuilds.push(presetId),
  };
  const panel = new TuningPanel(demo, library);

  // `selectPreset` only needs these mounted fields. Keeping the fake root
  // collapsed prevents it from asking the demo to change scene layouts.
  panel.controlContext = { config: panel.config };
  panel.presetSelect = { value: panel.presetId };
  panel.root = { classList: { contains: () => true } };
  panel.status = { textContent: '', dataset: {} };

  return { panel, library, rebuilds };
}

test('switching presets flushes the pending edit before replacing its config', () => {
  const { panel, library } = createPanel();

  panel.commit('trunk.bend', 0.77);
  panel.selectPreset('second');

  assert.equal(library.rawValue('first').trunk.bend, 0.77);
  assert.equal(panel.presetId, 'second');
  assert.equal(panel.commitTimer, null);
});

test('an apply already yielding to paint cannot rebuild a stale preset', async () => {
  const { panel, rebuilds } = createPanel();

  const applied = panel.apply();
  panel.selectPreset('second');

  assert.equal(await applied, true);
  assert.deepEqual(rebuilds, []);
});

test('a failed rebuild restores the previous library and editor configuration', async () => {
  const { panel, library } = createPanel();
  const previousBend = library.rawValue('first').trunk.bend;
  panel.config.trunk.bend = 0.77;
  panel.demo.rebuildPreset = () => {
    throw new Error('render failed');
  };

  assert.equal(await panel.apply(), false);
  assert.equal(library.rawValue('first').trunk.bend, previousBend);
  assert.equal(panel.config.trunk.bend, previousBend);
  assert.equal(panel.controlContext.config, panel.config);
  assert.equal(panel.status.textContent, 'render failed');
  assert.equal(panel.status.dataset.tone, 'error');
});

test('a failed studio scene change reports the error without throwing', () => {
  const { panel } = createPanel();
  panel.demo.setStudioPreset = () => {
    throw new Error('studio failed');
  };

  assert.equal(panel.tryStudioPreset('first'), false);
  assert.equal(panel.status.textContent, 'studio failed');
  assert.equal(panel.status.dataset.tone, 'error');
});

test('a failed open-studio preset switch restores the previous editor selection', () => {
  const { panel } = createPanel();
  const previousConfig = panel.config;
  panel.root = { classList: { contains: () => false } };
  panel.soloInput = { checked: true };
  panel.demo.setStudioPreset = () => {
    throw new Error('studio failed');
  };

  assert.equal(panel.selectPreset('second'), false);
  assert.equal(panel.presetId, 'first');
  assert.equal(panel.config, previousConfig);
  assert.equal(panel.controlContext.config, previousConfig);
  assert.equal(panel.presetSelect.value, 'first');
});

test('a failed reseed is contained and reported', () => {
  const { panel } = createPanel();
  panel.demo.reseed = () => {
    throw new Error('seed failed');
  };

  assert.equal(panel.reseedScene(), false);
  assert.equal(panel.status.textContent, 'seed failed');
  assert.equal(panel.status.dataset.tone, 'error');
});

test('the studio labels reference height as metadata rather than geometry', () => {
  const controls = TUNING_GROUPS.flatMap((group) => group.controls);
  const referenceHeight = controls.find((control) => control.path === 'height');
  const crownHeight = controls.find(
    (control) => control.path === 'crown.height',
  );

  assert.equal(referenceHeight?.label, 'Reference height');
  assert.equal(crownHeight?.label, 'Crown height');
  assert.equal(controls.some((control) => control.label === 'Tree height'), false);
});
