import assert from 'node:assert/strict';
import test from 'node:test';
import { createFoliageCardSizing } from '../src/generation/foliage-card-sizing.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../src/rendering/foliage-rendering-constants.js';

const TOLERANCE = 1e-12;

function createRandom(ratios) {
  const values = [...ratios];
  return {
    range(minimum, maximum) {
      const ratio = values.shift() ?? 0.5;
      return minimum + (maximum - minimum) * ratio;
    },
  };
}

test('packing changes coverage without resizing rendered geometry', () => {
  const baseSettings = {
    sizeRatio: [0.12, 0.12],
    widthRatio: [1, 1],
  };
  const loose = createFoliageCardSizing(
    2,
    { ...baseSettings, coverageCardRatio: 0.8 },
    1.4,
    createRandom([0.5, 0.5]),
  );
  const tight = createFoliageCardSizing(
    2,
    { ...baseSettings, coverageCardRatio: 0.4 },
    1.4,
    createRandom([0.5, 0.5]),
  );

  assert.equal(loose.cardWidth, tight.cardWidth);
  assert.equal(loose.shellScale, tight.shellScale);
  assert.ok(
    Math.abs(loose.coverageRadius - tight.coverageRadius * 2) <= TOLERANCE,
  );
});

test('profile spread limits random card widths without changing their center', () => {
  const settings = {
    sizeRatio: [0.1, 0.16],
    widthRatio: [0.72, 1.05],
    coverageCardRatio: 0.544,
  };
  const spread = 1.4;
  const minimum = createFoliageCardSizing(
    1,
    settings,
    spread,
    createRandom([0, 0]),
  );
  const maximum = createFoliageCardSizing(
    1,
    settings,
    spread,
    createRandom([1, 1]),
  );
  const minimumFactor =
    minimum.cardWidth /
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;
  const maximumFactor =
    maximum.cardWidth /
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;
  const center =
    ((settings.sizeRatio[0] + settings.sizeRatio[1]) * 0.5) *
    ((settings.widthRatio[0] + settings.widthRatio[1]) * 0.5);

  assert.ok(maximumFactor / minimumFactor <= spread + TOLERANCE);
  assert.ok(
    Math.abs(Math.sqrt(minimumFactor * maximumFactor) - center) <= TOLERANCE,
  );
});
