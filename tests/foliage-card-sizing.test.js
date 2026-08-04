import assert from 'node:assert/strict';
import test from 'node:test';
import { createFoliageCardSizing } from '../src/generation/foliage-card-sizing.js';
import { FOLIAGE_SHELL_CONSTANTS } from '../src/generation/foliage-shell-constants.js';
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

test('packing beyond the quad inradius expands geometry instead of coverage', () => {
  const settings = {
    sizeRatio: [0.12, 0.12],
    widthRatio: [1, 1],
    coverageCardRatio: 0.8,
  };
  const sizing = createFoliageCardSizing(
    2,
    settings,
    1.4,
    createRandom([0.5, 0.5]),
  );
  const requestedRadius =
    sizing.scale *
    sizing.widthRatio *
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier *
    settings.coverageCardRatio;

  assert.ok(Math.abs(sizing.coverageRadius - requestedRadius) <= TOLERANCE);
  assert.ok(sizing.shellScale > sizing.scale);
  assert.ok(
    sizing.coverageRadius / sizing.cardWidth <=
      FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio + TOLERANCE,
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
  const geometryCompensation =
    settings.coverageCardRatio /
    FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio;
  const minimumFactor =
    minimum.cardWidth /
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier /
    geometryCompensation;
  const maximumFactor =
    maximum.cardWidth /
    FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier /
    geometryCompensation;
  const center =
    ((settings.sizeRatio[0] + settings.sizeRatio[1]) * 0.5) *
    ((settings.widthRatio[0] + settings.widthRatio[1]) * 0.5);

  assert.ok(maximumFactor / minimumFactor <= spread + TOLERANCE);
  assert.ok(
    Math.abs(Math.sqrt(minimumFactor * maximumFactor) - center) <= TOLERANCE,
  );
});
