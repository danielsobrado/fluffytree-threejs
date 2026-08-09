import assert from 'node:assert/strict';
import test from 'node:test';
import { measureViewport } from '../src/rendering/viewport-size.js';

test('viewport dimensions are positive integers', () => {
  assert.deepEqual(measureViewport({ clientWidth: 1280.9, clientHeight: 720.2 }), {
    width: 1280,
    height: 720,
  });
});

test('zero and invalid viewport dimensions are clamped safely', () => {
  assert.deepEqual(measureViewport({ clientWidth: 0, clientHeight: Number.NaN }), {
    width: 1,
    height: 1,
  });
});
