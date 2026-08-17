import assert from 'node:assert/strict';
import test from 'node:test';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const RESPONSE = Object.freeze({
  phototropism: 0.8,
  windShaping: 0.7,
  slopeAdaptation: 0.5,
  competitionSensitivity: 0.9,
  pruningSensitivity: 0.8,
});

const ENVIRONMENT = Object.freeze({
  groundNormal: [0.25, 0.96, 0.08],
  lightDirection: [1, 0.8, 0.15],
  lightBias: 0.9,
  prevailingWindDirection: [-1, 0, 0.2],
  windStrength: 0.75,
  competitionVolumes: [
    { center: [0, 4, 0], radius: 30, strength: 0.7 },
  ],
  pruningVolumes: [
    { center: [0, 4, 0], radius: 12, strength: 0.85 },
  ],
});

function responsivePreset() {
  return Object.freeze({
    ...createTestPreset(),
    environmentResponse: RESPONSE,
  });
}

test('environmental growth is deterministic and changes structure only when enabled', () => {
  const generator = new TreeGenerator();
  const baselinePreset = createTestPreset();
  const baseline = generator.generateIr(baselinePreset, 441);
  const ignored = generator.generateIr(baselinePreset, 441, {
    environment: ENVIRONMENT,
  });
  const first = generator.generateIr(responsivePreset(), 441, {
    environment: ENVIRONMENT,
  });
  const second = generator.generateIr(responsivePreset(), 441, {
    environment: ENVIRONMENT,
  });

  assert.deepEqual(ignored, baseline);
  assert.deepEqual(first, second);
  assert.notDeepEqual(first.stems[0].path, baseline.stems[0].path);
  assert.equal(first.metadata.environment.applied, true);
});

test('competition reduces foliage potential and pruning invalidates old coverage certification', () => {
  const generator = new TreeGenerator();
  const baseline = generator.generateIr(responsivePreset(), 881);
  const adapted = generator.generateIr(responsivePreset(), 881, {
    environment: ENVIRONMENT,
  });

  assert.ok(adapted.foliageSites.length < baseline.foliageSites.length);
  assert.ok(adapted.foliageSites.some((site) => site.vigor < 1));
  assert.ok(adapted.crownVolumes.some((volume) => volume.density < 1));
  assert.equal(
    adapted.metadata.environment.prunedFoliageSiteCount,
    baseline.foliageSites.length - adapted.foliageSites.length,
  );
  assert.equal(adapted.metadata.legacy.shellCoverageDiagnostics.certified, false);
  assert.equal(
    adapted.metadata.legacy.shellCoverageDiagnostics.environmentInvalidated,
    true,
  );
});

test('legacy foliage render positions and coverage surface points move together', () => {
  const generator = new TreeGenerator();
  const baseline = generator.generateIr(responsivePreset(), 442);
  const adapted = generator.generateIr(responsivePreset(), 442, {
    environment: { ...ENVIRONMENT, pruningVolumes: [] },
  });
  const adaptedSite = adapted.foliageSites[0];
  const baselineSite = baseline.foliageSites.find(
    (site) => site.id === adaptedSite.id,
  );

  assert.notDeepEqual(
    adaptedSite.metadata.render.position,
    baselineSite.metadata.render.position,
  );
  assert.notDeepEqual(
    adaptedSite.metadata.render.surfacePoint,
    baselineSite.metadata.render.surfacePoint,
  );
});

test('the same environmental processor works on native palm IR', () => {
  const library = PresetLibrary.fromConfig(
    readYamlConfigSync(new URL('../config/palm-presets.yaml', import.meta.url)),
  );
  const source = library.get('coconutPalm');
  const preset = Object.freeze({ ...source, environmentResponse: RESPONSE });
  const generator = new TreeGenerator();
  const baseline = generator.generateIr(preset, 77);
  const adapted = generator.generateIr(preset, 77, { environment: ENVIRONMENT });

  assert.equal(adapted.stems.length, 1);
  assert.ok(adapted.foliageSites.every((site) => site.primitiveFamily === 'frond'));
  assert.notDeepEqual(adapted.stems[0].path, baseline.stems[0].path);
  assert.equal(adapted.windNodes.length, adapted.foliageSites.length + 1);
  assert.equal(
    adapted.metadata.environment.prunedWindNodeCount,
    baseline.windNodes.length - adapted.windNodes.length,
  );
});
