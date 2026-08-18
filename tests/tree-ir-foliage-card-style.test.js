import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeIrFoliageCardStyle } from '../src/rendering/tree-ir-foliage-card-style.js';

const CONFIG = Object.freeze({
  cardScaleVariation: 0.08,
  cardStretch: 0.12,
  cardTwist: 0.32,
  cardLean: 0.12,
  canopyHeightTint: 0.08,
  canopyRadialTint: 0.05,
});

test('native foliage card style is deterministic and bounded', () => {
  const treeIr = { seed: 104729 };
  const site = { id: 'foliage:17' };
  const first = calculateTreeIrFoliageCardStyle(treeIr, site, CONFIG);
  const second = calculateTreeIrFoliageCardStyle(treeIr, site, CONFIG);

  assert.deepEqual(first, second);
  assert.ok(first.widthScale >= 0.8 && first.widthScale <= 1.22);
  assert.ok(first.heightScale >= 0.85 && first.heightScale <= 1.16);
  assert.ok(Math.abs(first.twist) <= CONFIG.cardTwist);
  assert.ok(Math.abs(first.leanX) <= CONFIG.cardLean);
  assert.ok(Math.abs(first.leanZ) <= CONFIG.cardLean);
  assert.ok(first.brightness >= 0.96 && first.brightness <= 1.04);
});

test('native foliage card style varies across sites', () => {
  const treeIr = { seed: 104729 };
  const first = calculateTreeIrFoliageCardStyle(treeIr, { id: 'foliage:1' }, CONFIG);
  const second = calculateTreeIrFoliageCardStyle(treeIr, { id: 'foliage:2' }, CONFIG);

  assert.notDeepEqual(first, second);
});

test('upper outer foliage receives subtle canopy exposure lift', () => {
  const treeIr = {
    seed: 104729,
    bounds: {
      minimum: { x: -5, y: 0, z: -5 },
      maximum: { x: 5, y: 10, z: 5 },
    },
  };
  const lowerInner = calculateTreeIrFoliageCardStyle(
    treeIr,
    {
      id: 'foliage:exposure',
      frame: { position: { x: 0, y: 2, z: 0 } },
    },
    CONFIG,
  );
  const upperOuter = calculateTreeIrFoliageCardStyle(
    treeIr,
    {
      id: 'foliage:exposure',
      frame: { position: { x: 4.5, y: 9, z: 4.5 } },
    },
    CONFIG,
  );

  assert.ok(upperOuter.brightness > lowerInner.brightness);
  assert.ok(upperOuter.canopyHeight > lowerInner.canopyHeight);
  assert.ok(upperOuter.canopyRadial > lowerInner.canopyRadial);
});
