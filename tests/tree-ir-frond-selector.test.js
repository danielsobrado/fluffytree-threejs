import assert from 'node:assert/strict';
import test from 'node:test';
import { selectTreeIrFrondSites } from '../src/rendering/tree-ir-frond-selector.js';

function createSites(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `frond:${index}`,
    metadata: {
      frond: {
        azimuth: (index / count) * Math.PI * 2,
      },
    },
  }));
}

test('frond thinning keeps samples evenly distributed around the crown', () => {
  const sites = createSites(12);
  const selected = selectTreeIrFrondSites({ seed: 991 }, sites, 'aggregate', 0.5);
  const indices = selected
    .map((site) => Number(site.id.split(':')[1]))
    .sort((left, right) => left - right);
  const gaps = indices.map((value, index) => {
    const next = indices[(index + 1) % indices.length];
    return (next - value + sites.length) % sites.length;
  });

  assert.equal(selected.length, 6);
  assert.deepEqual(new Set(gaps), new Set([2]));
});

test('frond selection is deterministic for the same seed and role', () => {
  const sites = createSites(17);
  const first = selectTreeIrFrondSites({ seed: 1234 }, sites, 'near', 0.58);
  const second = selectTreeIrFrondSites({ seed: 1234 }, sites, 'near', 0.58);

  assert.deepEqual(first, second);
});

test('frond selection preserves full and empty density boundaries', () => {
  const sites = createSites(5);

  assert.deepEqual(selectTreeIrFrondSites({ seed: 1 }, sites, 'hero', 1), sites);
  assert.deepEqual(selectTreeIrFrondSites({ seed: 1 }, sites, 'aggregate', 0), []);
});
