import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSurfaceLayerScale,
  calculateSurfaceRadialOffset,
  getEffectiveOuterOffsetRatio,
  getInnerInsetRatio,
  getLeafRootInsetRatio,
  getOuterOffsetRatio,
} from '../src/rendering/leaf-cluster-layer-layout.js';
import { LEAF_DETAIL_RENDERING_CONSTANTS } from '../src/rendering/leaf-detail-rendering-constants.js';

const SETTINGS = Object.freeze({
  embedRatio: 0.14,
  layerCount: 1,
  layerOffsetRatio: 0.16,
});

test('single leaf-detail layer keeps every leaf root outside the crown surface', () => {
  const instanceScale = 1.5;
  const offset = calculateSurfaceRadialOffset(0, SETTINGS, instanceScale);
  const rootInset = getLeafRootInsetRatio(SETTINGS) * instanceScale;
  const requiredClearance =
    LEAF_DETAIL_RENDERING_CONSTANTS.rootSurfaceClearanceRatio * instanceScale;

  assert.ok(
    Math.abs(
      offset - getEffectiveOuterOffsetRatio(SETTINGS) * instanceScale,
    ) < 1e-12,
  );
  assert.ok(offset - rootInset >= requiredClearance - 1e-12);
  assert.ok(
    getEffectiveOuterOffsetRatio(SETTINGS) > getOuterOffsetRatio(SETTINGS),
  );
});

test('single leaf-detail layer keeps its existing balanced scale', () => {
  assert.equal(calculateSurfaceLayerScale(0, SETTINGS), 0.99);
});

test('multiple leaf-detail layers still span the inner and safe outer crown', () => {
  const settings = { ...SETTINGS, layerCount: 3 };
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
        getEffectiveOuterOffsetRatio(settings) * instanceScale,
    ) < 1e-12,
  );
});
