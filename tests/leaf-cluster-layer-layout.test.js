import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSurfaceLayerScale,
  calculateSurfaceRadialOffset,
  getInnerInsetRatio,
  getOuterOffsetRatio,
} from '../src/rendering/leaf-cluster-layer-layout.js';

const SETTINGS = Object.freeze({ layerCount: 1, layerOffsetRatio: 0.16 });

test('single leaf-detail layer stays outside the crown surface', () => {
  const instanceScale = 1.5;
  const offset = calculateSurfaceRadialOffset(0, SETTINGS, instanceScale);

  assert.ok(
    Math.abs(offset - getOuterOffsetRatio(SETTINGS) * instanceScale) < 1e-12,
  );
  assert.ok(offset > 0);
});

test('single leaf-detail layer keeps its existing balanced scale', () => {
  assert.equal(calculateSurfaceLayerScale(0, SETTINGS), 0.99);
});

test('multiple leaf-detail layers still span the inner and outer crown', () => {
  const settings = { layerCount: 3, layerOffsetRatio: 0.16 };
  const instanceScale = 2;

  assert.ok(
    Math.abs(
      calculateSurfaceRadialOffset(0, settings, instanceScale) +
        getInnerInsetRatio(settings) * instanceScale,
    ) < 1e-12,
  );
  assert.ok(
    Math.abs(
      calculateSurfaceRadialOffset(2, settings, instanceScale) -
        getOuterOffsetRatio(settings) * instanceScale,
    ) < 1e-12,
  );
});
