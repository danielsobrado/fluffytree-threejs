import assert from 'node:assert/strict';
import test from 'node:test';
import {
  analyzeSilhouetteHoles,
  createAlphaMask,
} from '../src/qa/silhouette-hole-analyzer.js';

const SIZE = 32;

function createMask(fill) {
  const mask = new Uint8Array(SIZE * SIZE);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      mask[x + y * SIZE] = fill(x, y) ? 1 : 0;
    }
  }
  return mask;
}

function createRing(holeHalfWidth) {
  return createMask((x, y) => {
    const inside = x >= 4 && x < 28 && y >= 4 && y < 28;
    const inHole =
      Math.abs(x - 16) < holeHalfWidth && Math.abs(y - 16) < holeHalfWidth;
    return inside && !inHole;
  });
}

test('a solid silhouette reports no holes', () => {
  const metrics = analyzeSilhouetteHoles(
    createMask((x, y) => x >= 4 && x < 28 && y >= 4 && y < 28),
    SIZE,
    SIZE,
  );

  assert.equal(metrics.holePixels, 0);
  assert.equal(metrics.holeCount, 0);
  assert.equal(metrics.holeRatio, 0);
  assert.equal(metrics.coveredPixels, 24 * 24);
});

test('an enclosed opening is measured against the filled silhouette', () => {
  const metrics = analyzeSilhouetteHoles(createRing(3), SIZE, SIZE);

  assert.equal(metrics.holeCount, 1);
  assert.equal(metrics.holePixels, 25);
  assert.equal(metrics.largestHolePixels, 25);
  assert.equal(metrics.coveredPixels, 24 * 24 - 25);
  assert.equal(metrics.filledPixels, 24 * 24);
  assert.ok(Math.abs(metrics.holeRatio - 25 / 576) < 1e-9);
});

test('background reaching the border is not a hole', () => {
  const metrics = analyzeSilhouetteHoles(
    createMask((x, y) => x >= 4 && x < 28 && y >= 4 && y < 12),
    SIZE,
    SIZE,
  );

  assert.equal(metrics.holePixels, 0);
});

test('a diagonally stepped gap does not drain an enclosed opening', () => {
  const mask = createRing(3);
  // A staircase of background cells that only ever touch corner to corner. Eight
  // way connectivity would let the opening leak to the border through it; four
  // way connectivity keeps the opening enclosed, which matches what the eye sees.
  for (let step = 0; step < 9; step += 1) {
    mask[19 + step + (16 + step) * SIZE] = 0;
  }
  const metrics = analyzeSilhouetteHoles(mask, SIZE, SIZE, {
    minimumHolePixels: 2,
  });

  assert.equal(metrics.holeCount, 1);
  assert.equal(metrics.largestHolePixels, 26);
});

test('openings narrower than the minimum radius are ignored', () => {
  const narrow = analyzeSilhouetteHoles(createRing(1), SIZE, SIZE, {
    minimumHoleRadius: 2,
  });
  const wide = analyzeSilhouetteHoles(createRing(4), SIZE, SIZE, {
    minimumHoleRadius: 2,
  });

  assert.equal(narrow.holeCount, 0);
  assert.equal(narrow.holeRatio, 0);
  assert.ok(narrow.holePixels > 0, 'the opening is still reported as raw area');
  assert.equal(wide.holeCount, 1);
  assert.ok(wide.holeRatio > 0);
});

test('the hole mask marks every counted opening', () => {
  const holeMask = new Uint8Array(SIZE * SIZE);
  analyzeSilhouetteHoles(createRing(3), SIZE, SIZE, { holeMask });

  assert.equal(holeMask[16 + 16 * SIZE], 1);
  assert.equal(holeMask[5 + 5 * SIZE], 0);
  assert.equal(holeMask.reduce((total, value) => total + value, 0), 25);
});

test('the alpha mask separates cut-out foliage from the cleared background', () => {
  const pixels = new Uint8Array(4 * 4 * 4);
  pixels[3] = 0;
  pixels[7] = 255;
  pixels[11] = 120;
  pixels[15] = 40;
  const mask = createAlphaMask(pixels, 4, 4, 64);

  assert.deepEqual([...mask.slice(0, 4)], [0, 1, 1, 0]);
});

test('a mismatched mask size is rejected', () => {
  assert.throws(
    () => analyzeSilhouetteHoles(new Uint8Array(10), 4, 4),
    /does not match/,
  );
});
