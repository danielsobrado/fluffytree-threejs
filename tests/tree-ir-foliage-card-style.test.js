import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeIrFoliageCardStyle } from '../src/rendering/tree-ir-foliage-card-style.js';

const CONFIG = Object.freeze({
  cardScaleVariation: 0.08,
  cardStretch: 0.12,
  cardTwist: 0.32,
});

test('native foliage card style is deterministic and bounded', () => {
  const treeIr = { seed: 104729 };
  const site = { id: 'foliage:17' };
  const first = calculateTreeIrFoliageCardStyle(treeIr, site, CONFIG);
  const second = calculateTreeIrFoliageCardStyle(treeIr, site, CONFIG);

  assert.deepEqual(first, second);
  assert.ok(first.widthScale >= 0.8 && first.widthScale <= 1.22);
  assert.ok(first.heightScale >= 0.86 && first.heightScale <= 1.15);
  assert.ok(Math.abs(first.twist) <= CONFIG.cardTwist);
  assert.ok(first.brightness >= 0.96 && first.brightness <= 1.04);
});

test('native foliage card style varies across sites', () => {
  const treeIr = { seed: 104729 };
  const first = calculateTreeIrFoliageCardStyle(treeIr, { id: 'foliage:1' }, CONFIG);
  const second = calculateTreeIrFoliageCardStyle(treeIr, { id: 'foliage:2' }, CONFIG);

  assert.notDeepEqual(first, second);
});
