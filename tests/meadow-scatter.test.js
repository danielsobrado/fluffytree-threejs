import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_MEADOW,
  createMeadowScatter,
  resolveMeadowSettings,
} from '../src/rendering/meadow-scatter.js';

const settings = resolveMeadowSettings({ count: 2000, radius: 20 });

test('an unconfigured scene gets the tuned carpet', () => {
  assert.deepEqual(resolveMeadowSettings(), { ...DEFAULT_MEADOW });
});

test('an empty palette falls back rather than scattering colourless tufts', () => {
  const empty = resolveMeadowSettings({ grassColors: [], flowerColors: [] });

  assert.deepEqual(empty.grassColors, DEFAULT_MEADOW.grassColors);
  assert.deepEqual(empty.flowerColors, DEFAULT_MEADOW.flowerColors);
});

test('the same seed grows the same meadow', () => {
  assert.deepEqual(createMeadowScatter(settings), createMeadowScatter(settings));
});

test('a different seed grows a different meadow', () => {
  const other = createMeadowScatter({ ...settings, seed: settings.seed + 1 });

  assert.notDeepEqual(createMeadowScatter(settings), other);
});

test('every tuft stands inside the carpet', () => {
  for (const instance of createMeadowScatter(settings)) {
    assert.ok(Math.hypot(instance.x, instance.z) <= settings.radius + 1e-9);
    assert.ok(instance.scale >= settings.scale[0]);
    assert.ok(instance.scale <= settings.scale[1]);
  }
});

test('the scatter is even over the area, not crowded into the middle', () => {
  const instances = createMeadowScatter(settings);
  // Half the area of a disc lies outside 1/sqrt(2) of its radius, so an even
  // scatter puts about half the tufts there. Sampling the radius uniformly
  // would put roughly 30% there instead.
  const outerShare =
    instances.filter(
      (instance) =>
        Math.hypot(instance.x, instance.z) > settings.radius / Math.SQRT2,
    ).length / instances.length;

  assert.ok(Math.abs(outerShare - 0.5) < 0.05, `outer share ${outerShare}`);
});

test('roughly the configured share of the carpet flowers', () => {
  const instances = createMeadowScatter({ ...settings, flowerShare: 0.3 });
  const share = instances.filter((instance) => instance.flower).length /
    instances.length;

  assert.ok(Math.abs(share - 0.3) < 0.04, `flower share ${share}`);
});

test('grass and flowers draw from their own palettes', () => {
  for (const instance of createMeadowScatter(settings)) {
    const palette = instance.flower
      ? settings.flowerColors
      : settings.grassColors;
    assert.ok(palette.includes(instance.color));
  }
});
