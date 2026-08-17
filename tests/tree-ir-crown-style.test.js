import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeIrCrownStyle } from '../src/rendering/tree-ir-crown-style.js';

const CONFIG = Object.freeze({
  shapeVariation: 0.08,
  brightness: 0.7,
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
