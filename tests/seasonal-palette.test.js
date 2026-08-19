import assert from 'node:assert/strict';
import test from 'node:test';
import {
  blendPaletteToSeason,
  sampleRamp,
} from '../src/rendering/seasonal-palette.js';

const palette = ['#2f4b32', '#5c7f4c', '#93b56d', '#d3e2a4'];
const autumn = ['#6b3520', '#a85a2c', '#cf8442', '#eab97a'];

test('a ramp reads its own ends at its own ends', () => {
  assert.deepEqual(sampleRamp(autumn, 0), { r: 0x6b, g: 0x35, b: 0x20 });
  assert.deepEqual(sampleRamp(autumn, 1), { r: 0xea, g: 0xb9, b: 0x7a });
});

test('a ramp interpolates between its stops', () => {
  const middle = sampleRamp(['#000000', '#ffffff'], 0.5);

  assert.deepEqual(middle, { r: 127.5, g: 127.5, b: 127.5 });
});

test('a position outside the ramp is clamped to it', () => {
  assert.deepEqual(sampleRamp(autumn, -3), sampleRamp(autumn, 0));
  assert.deepEqual(sampleRamp(autumn, 9), sampleRamp(autumn, 1));
});

test('a single-stop ramp is that stop everywhere', () => {
  assert.deepEqual(sampleRamp(['#123456'], 0.4), { r: 0x12, g: 0x34, b: 0x56 });
});

test('an empty ramp leaves the palette alone', () => {
  assert.deepEqual(blendPaletteToSeason(palette, [], 1), palette);
  assert.deepEqual(blendPaletteToSeason(palette, autumn, 0), palette);
});

test('a full blend lands on the season ramp', () => {
  assert.deepEqual(blendPaletteToSeason(palette, autumn, 1), autumn);
});

test('a blend past one is still just the season ramp', () => {
  assert.deepEqual(blendPaletteToSeason(palette, autumn, 4), autumn);
});

test('a partial blend sits between the two', () => {
  const [first] = blendPaletteToSeason(palette, autumn, 0.5);
  const red = Number.parseInt(first.slice(1, 3), 16);

  assert.equal(red, Math.round((0x2f + 0x6b) / 2));
});

test('every entry stays a six digit hex colour', () => {
  for (const entry of blendPaletteToSeason(palette, autumn, 0.37)) {
    assert.match(entry, /^#[0-9a-f]{6}$/);
  }
});

test('a palette of a different length still spans the whole ramp', () => {
  const short = ['#000000', '#ffffff'];
  const blended = blendPaletteToSeason(short, autumn, 1);

  assert.deepEqual(blended, ['#6b3520', '#eab97a']);
});

test('an unparseable entry is passed through, not dropped', () => {
  const blended = blendPaletteToSeason(
    ['#2f4b32', 'rebeccapurple', '#d3e2a4'],
    autumn,
    1,
  );

  assert.equal(blended.length, 3);
  assert.equal(blended[1], 'rebeccapurple');
});
