import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateHeroClusterStretch,
  calculateHeroLeafSelectionProbability,
  selectHeroLeafSamples,
} from '../src/rendering/hero-leaf-style.js';

test('hero leaf probability favors exposed foliage without exceeding bounds', () => {
  const density = 0.2;
  const hidden = calculateHeroLeafSelectionProbability(density, 0);
  const middle = calculateHeroLeafSelectionProbability(density, 0.5);
  const exposed = calculateHeroLeafSelectionProbability(density, 1);

  assert.ok(hidden < middle);
  assert.ok(middle < exposed);
  assert.equal(middle, density);
  assert.equal(calculateHeroLeafSelectionProbability(1, 1), 1);
});

test('hero leaf sample selection is deterministic and exposure aware', () => {
  const treeData = {
    seed: 55,
    shell: Array.from({ length: 40 }, (_, id) => ({
      id,
      exposure: id < 20 ? 0 : 1,
    })),
  };
  const first = selectHeroLeafSamples(treeData, 0.4);
  const second = selectHeroLeafSamples(treeData, 0.4);
  const hiddenCount = first.filter((sample) => sample.exposure === 0).length;
  const exposedCount = first.filter((sample) => sample.exposure === 1).length;

  assert.deepEqual(first, second);
  assert.ok(exposedCount > hiddenCount);
});

test('hero cluster stretch is deterministic, subtle and anisotropic', () => {
  const first = calculateHeroClusterStretch(9, 12, 0);
  const second = calculateHeroClusterStretch(9, 12, 0);
  const layered = calculateHeroClusterStretch(9, 12, 1);

  assert.deepEqual(first, second);
  assert.ok(first.x >= 0.92 && first.x <= 1.08);
  assert.ok(first.z >= 0.92 && first.z <= 1.08);
  assert.notDeepEqual(first, layered);
});
