import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { samplePaletteColor } from '../src/rendering/palette-color-sampler.js';

test('palette sampling reuses a supplied color target', () => {
  const target = new THREE.Color();
  const result = samplePaletteColor(['#000000', '#ffffff'], 0.25, target);

  assert.equal(result, target);
  assert.ok(Math.abs(result.r - 0.25) < 1e-12);
  assert.ok(Math.abs(result.g - 0.25) < 1e-12);
  assert.ok(Math.abs(result.b - 0.25) < 1e-12);
});

test('palette sampling clamps coordinates without mutating cached colors', () => {
  const target = new THREE.Color();
  samplePaletteColor(['#ff0000', '#00ff00'], -1, target);
  assert.equal(target.getHex(), 0xff0000);

  samplePaletteColor(['#ff0000', '#00ff00'], 2, target);
  assert.equal(target.getHex(), 0x00ff00);

  const fresh = samplePaletteColor(['#ff0000'], 0.5);
  assert.equal(fresh.getHex(), 0xff0000);
});
