import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeIrCrownStyle } from '../src/rendering/tree-ir-crown-style.js';

const CONFIG = Object.freeze({
  shapeVariation: 0.08,
  brightness: 0.7,
  depthShading: 0.14,
});

test('native crown interior style is deterministic and bounded', () => {
  const treeIr = { seed: 401111 };
  const volume = { id: 'crown:9' };
  const first = calculateTreeIrCrownStyle(treeIr, volume, CONFIG);
  const second = calculateTreeIrCrownStyle(treeIr, volume, CONFIG);

  assert.deepEqual(first, second);
  for (const value of [first.scaleX, first.scaleY, first.scaleZ]) {
    assert.ok(value >= 0.92 && value <= 1.08);
  }
  assert.ok(first.brightness >= 0.672 && first.brightness <= 0.728);
});

test('recessed crown volumes shade darker than exposed volumes', () => {
  const treeIr = { seed: 401111 };
  const volume = { id: 'crown:9' };
  const exposed = calculateTreeIrCrownStyle(treeIr, volume, CONFIG, 1);
  const recessed = calculateTreeIrCrownStyle(treeIr, volume, CONFIG, 0);

  assert.ok(recessed.brightness < exposed.brightness);
  assert.ok(
    Math.abs(recessed.brightness / exposed.brightness - (1 - CONFIG.depthShading)) <
      1e-12,
  );
});
