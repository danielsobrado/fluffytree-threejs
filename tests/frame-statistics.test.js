import assert from 'node:assert/strict';
import test from 'node:test';
import { FrameStatistics } from '../src/diagnostics/frame-statistics.js';
import { resolveShadowAnchor } from '../src/rendering/shadow-anchor.js';

test('a steady sixty frames a second reads as sixty', () => {
  const statistics = new FrameStatistics({ windowMs: 500 });

  for (let frame = 0; frame <= 120; frame += 1) {
    statistics.sample(frame * (1000 / 60));
  }

  assert.ok(Math.abs(statistics.fps - 60) < 0.5);
  assert.ok(Math.abs(statistics.frameMs - 1000 / 60) < 0.1);
  assert.ok(Math.abs(statistics.worstFrameMs - 1000 / 60) < 0.1);
});

test('a stall is reported as the worst frame and leaves the window', () => {
  const statistics = new FrameStatistics({ windowMs: 400 });

  statistics.sample(0);
  statistics.sample(16);
  statistics.sample(216);

  assert.ok(Math.abs(statistics.worstFrameMs - 200) < 1e-9);

  for (let frame = 1; frame <= 60; frame += 1) {
    statistics.sample(216 + frame * 16);
  }

  assert.ok(Math.abs(statistics.worstFrameMs - 16) < 1e-9);
});

test('a single frame reports nothing rather than infinity', () => {
  const statistics = new FrameStatistics();
  statistics.sample(1000);

  assert.equal(statistics.fps, 0);
  assert.equal(statistics.frameMs, 0);
  assert.equal(statistics.worstFrameMs, 0);
});

test('the sun only re-anchors once the viewer has walked a whole step', () => {
  const first = resolveShadowAnchor(null, { x: 1, z: -1 }, 6);
  assert.deepEqual(first, { anchor: { x: 0, z: -0 }, moved: true });

  const nudged = resolveShadowAnchor(first.anchor, { x: 2.5, z: 1 }, 6);
  assert.equal(nudged.moved, false);

  const walked = resolveShadowAnchor(first.anchor, { x: 9, z: 1 }, 6);
  assert.equal(walked.moved, true);
  assert.equal(walked.anchor.x, 12);
});
