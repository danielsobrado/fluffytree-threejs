import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SEASONS,
  SUMMER_SEASON,
  applySeasonToPreset,
  applySeasonToPresets,
  applySeasonToScene,
  requestedSeason,
  resolveSeason,
} from '../src/app/season.js';

const config = Object.freeze({
  scene: {
    backgroundColor: '#cfe3ea',
    fogColor: '#cfe3ea',
    fogNear: 24,
    groundColor: '#8aa860',
    groundSize: 72,
    lightPools: { enabled: true, cellSize: 9, amplitude: 0.06, warmth: 0.55 },
    contactShadow: { enabled: true, strength: 0.42 },
    meadow: { enabled: true, count: 3600, radius: 26 },
  },
  lighting: { sunIntensity: 2.35, sunPosition: [14, 12, 7] },
  lod: { nearPixels: 300 },
});

function preset(id, palette, extra = {}) {
  return Object.freeze({
    id,
    height: 7,
    foliage: Object.freeze({ palette: Object.freeze(palette), ...extra }),
  });
}

const presets = new Map([
  ['orchard', preset('orchard', ['#2f4b32', '#5c7f4c', '#93b56d', '#d3e2a4'])],
  ['frost', preset('frost', ['#4a5a58', '#6f8079'], { seasonal: false })],
]);

test('the four seasons are offered, summer among them', () => {
  assert.deepEqual(
    SEASONS.map((season) => season.id),
    ['spring', 'summer', 'autumn', 'winter'],
  );
});

test('an unknown season falls back to summer rather than throwing', () => {
  assert.equal(resolveSeason('monsoon'), SUMMER_SEASON);
  assert.equal(resolveSeason(undefined), SUMMER_SEASON);
  assert.equal(requestedSeason('?season=monsoon'), SUMMER_SEASON);
  assert.equal(requestedSeason(''), SUMMER_SEASON);
});

test('a season can be asked for by name', () => {
  assert.equal(requestedSeason('?season=autumn'), 'autumn');
  assert.equal(requestedSeason('?scene=forest&season=winter'), 'winter');
});

test('summer is the configuration itself, untouched', () => {
  assert.equal(applySeasonToScene(config, SUMMER_SEASON), config);
  assert.equal(applySeasonToPresets(presets, SUMMER_SEASON), presets);
});

test('a season keeps everything it does not speak for', () => {
  const winter = applySeasonToScene(config, 'winter');

  assert.equal(winter.scene.fogNear, config.scene.fogNear);
  assert.equal(winter.scene.groundSize, config.scene.groundSize);
  assert.equal(winter.scene.lightPools.cellSize, config.scene.lightPools.cellSize);
  assert.equal(winter.scene.meadow.radius, config.scene.meadow.radius);
  assert.deepEqual(winter.lod, config.lod);
});

test('winter matches the fog to the sky, as every scene must', () => {
  const winter = applySeasonToScene(config, 'winter');

  assert.equal(winter.scene.fogColor, winter.scene.backgroundColor);
});

test('every season matches its fog to its sky', () => {
  for (const { id } of SEASONS) {
    const dressed = applySeasonToScene(config, id);
    assert.equal(
      dressed.scene.fogColor,
      dressed.scene.backgroundColor,
      `${id} fog does not match its sky`,
    );
  }
});

test('only winter lays snow', () => {
  for (const { id } of SEASONS) {
    const turned = applySeasonToPresets(presets, id).get('orchard');
    const laden = Number(turned.foliage.snowStrength ?? 0) > 0;

    assert.equal(laden, id === 'winter', `${id} snow`);
  }
});

test('a season turns the canopy but keeps its value ramp', () => {
  const turned = applySeasonToPresets(presets, 'autumn').get('orchard');
  const original = presets.get('orchard').foliage.palette;

  assert.equal(turned.foliage.palette.length, original.length);
  assert.notDeepEqual([...turned.foliage.palette], [...original]);
  // Darkest still darkest, lightest still lightest: the shader's palette
  // texture samples this ramp for cavity, height and exposure.
  const luminance = (hex) =>
    Number.parseInt(hex.slice(1, 3), 16) +
    Number.parseInt(hex.slice(3, 5), 16) +
    Number.parseInt(hex.slice(5, 7), 16);
  const values = turned.foliage.palette.map(luminance);
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] > values[index - 1], `ramp reversed at ${index}`);
  }
});

test('autumn warms the canopy rather than cooling it', () => {
  const turned = applySeasonToPresets(presets, 'autumn').get('orchard');

  for (const [index, hex] of turned.foliage.palette.entries()) {
    const original = presets.get('orchard').foliage.palette[index];
    const red = (value) => Number.parseInt(value.slice(1, 3), 16);
    assert.ok(red(hex) > red(original), `entry ${index} did not warm`);
  }
});

test('a preset that is itself a season is left alone by one', () => {
  for (const { id } of SEASONS) {
    const turned = applySeasonToPresets(presets, id).get('frost');
    assert.deepEqual(turned, presets.get('frost'), `${id} overruled the opt-out`);
  }
});

test('seasonal preset maps refresh edited presets without churning unchanged ones', () => {
  const source = new Map(presets);
  const seasonal = applySeasonToPresets(source, 'autumn');
  const originalTurned = seasonal.get('orchard');
  const originalFrost = seasonal.get('frost');

  assert.equal(seasonal.get('orchard'), originalTurned);

  const edited = preset('orchard', [
    '#25382a',
    '#4f7046',
    '#87a968',
    '#c5d99a',
  ]);
  source.set('orchard', edited);

  const refreshed = seasonal.get('orchard');
  assert.notEqual(refreshed, originalTurned);
  assert.deepEqual(refreshed, applySeasonToPreset(edited, 'autumn'));
  assert.equal(seasonal.get('orchard'), refreshed);
  assert.equal(seasonal.get('frost'), originalFrost);

  source.set('newTree', preset('newTree', ['#314631', '#769064']));
  assert.equal(seasonal.size, 3);
  assert.ok(seasonal.has('newTree'));

  source.delete('frost');
  assert.equal(seasonal.has('frost'), false);
  assert.equal(seasonal.size, 2);
});
