import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_GROUND_POOLS,
  applyGroundPool,
  resolveGroundPoolSettings,
  sampleGroundPool,
} from '../src/rendering/ground-light-pools.js';

const settings = resolveGroundPoolSettings();
const meadow = { r: 0.28, g: 0.42, b: 0.14 };

function samples(count, step) {
  const values = [];
  for (let index = 0; index < count; index += 1) {
    values.push(sampleGroundPool(index * step, index * step * 0.63, settings));
  }
  return values;
}

test('an unconfigured scene gets the tuned pools', () => {
  assert.deepEqual(settings, { ...DEFAULT_GROUND_POOLS });
});

test('a cell size of zero cannot reach the noise as a division by zero', () => {
  const level = sampleGroundPool(3, 5, resolveGroundPoolSettings({ cellSize: 0 })).level;

  assert.ok(Number.isFinite(level));
});

test('the pools stay inside the range the amplitude promises', () => {
  for (const { level } of samples(400, 1.7)) {
    assert.ok(level >= -1 && level <= 1, `level ${level}`);
  }
});

test('the same point is the same colour every time the scene is opened', () => {
  assert.deepEqual(
    applyGroundPool(meadow, 12.5, -7.25, settings),
    applyGroundPool(meadow, 12.5, -7.25, settings),
  );
});

test('a different seed pools the light somewhere else', () => {
  const shifted = resolveGroundPoolSettings({ seed: DEFAULT_GROUND_POOLS.seed + 1 });

  assert.notDeepEqual(
    applyGroundPool(meadow, 12.5, -7.25, settings),
    applyGroundPool(meadow, 12.5, -7.25, shifted),
  );
});

test('the pools vary over metres, not over blades', () => {
  const near = sampleGroundPool(0, 0, settings).level;
  const nudged = sampleGroundPool(0.2, 0.2, settings).level;
  const away = sampleGroundPool(settings.cellSize * 1.5, 0, settings).level;

  assert.ok(Math.abs(nudged - near) < Math.abs(away - near));
});

test('only the lit side warms; hollows are left to the sky', () => {
  for (const { level, warmth } of samples(200, 2.3)) {
    if (level <= 0) assert.equal(warmth, 0);
    else assert.ok(warmth > 0);
  }
});

test('a warmed patch gains red and loses blue', () => {
  const warm = samples(400, 1.3).findIndex(({ warmth }) => warmth > 0.2);
  assert.notEqual(warm, -1, 'no warm patch in the sample');

  const x = warm * 1.3;
  const z = warm * 1.3 * 0.63;
  const pooled = applyGroundPool(meadow, x, z, settings);

  assert.ok(pooled.r / meadow.r > pooled.b / meadow.b);
});

test('turning the pools off leaves the configured meadow colour alone', () => {
  const flat = resolveGroundPoolSettings({ enabled: false });

  assert.deepEqual(applyGroundPool(meadow, 4, 9, flat), meadow);
});

test('a channel is never driven past white', () => {
  const bright = { r: 1, g: 1, b: 1 };

  for (let index = 0; index < 200; index += 1) {
    const pooled = applyGroundPool(bright, index * 1.9, index * 0.7, settings);
    assert.ok(pooled.r <= 1 && pooled.g <= 1 && pooled.b <= 1);
  }
});
