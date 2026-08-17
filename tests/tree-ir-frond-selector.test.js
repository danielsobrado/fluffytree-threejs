import assert from 'node:assert/strict';
import test from 'node:test';
import { selectTreeIrFrondSites } from '../src/rendering/tree-ir-frond-selector.js';

const TAU = Math.PI * 2;

function createSites(count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `frond:${index}`,
    metadata: {
      frond: {
        azimuth: (index / count) * TAU,
      },
    },
  }));
}

function ids(sites) {
  return sites.map((site) => site.id);
}

test('frond thinning remains distributed around the crown', () => {
  const sites = createSites(12);
  const selected = selectTreeIrFrondSites({ seed: 991 }, sites, 0.5);
  const indices = selected
    .map((site) => Number(site.id.split(':')[1]))
    .sort((left, right) => left - right);
  const gaps = indices.map((value, index) => {
    const next = indices[(index + 1) % indices.length];
    return (next - value + sites.length) % sites.length;
  });

  assert.equal(selected.length, 6);
  assert.ok(Math.max(...gaps) <= 3);
});

test('denser frond LODs preserve every frond from sparser LODs', () => {
  const sites = createSites(18);
  const sparse = selectTreeIrFrondSites({ seed: 1234 }, sites, 0.58);
  const dense = selectTreeIrFrondSites({ seed: 1234 }, sites, 0.72);
  const denseIds = new Set(ids(dense));

  assert.equal(sparse.length, 10);
  assert.equal(dense.length, 13);
  assert.equal(sparse.every((site) => denseIds.has(site.id)), true);
});

test('frond selection is deterministic for the same seed', () => {
  const sites = createSites(17);
  const first = selectTreeIrFrondSites({ seed: 1234 }, sites, 0.58);
  const second = selectTreeIrFrondSites({ seed: 1234 }, sites, 0.58);

  assert.deepEqual(first, second);
});

test('frond selection normalizes wrapped azimuth values', () => {
  const sites = createSites(9);
  const wrapped = sites.map((site, index) => ({
    ...site,
    metadata: {
      frond: {
        azimuth:
          site.metadata.frond.azimuth + (index % 2 === 0 ? TAU : -TAU),
      },
    },
  }));

  assert.deepEqual(
    ids(selectTreeIrFrondSites({ seed: 77 }, wrapped, 0.55)),
    ids(selectTreeIrFrondSites({ seed: 77 }, sites, 0.55)),
  );
});

test('frond selection preserves full and empty density boundaries', () => {
  const sites = createSites(5);

  assert.deepEqual(selectTreeIrFrondSites({ seed: 1 }, sites, 1), sites);
  assert.deepEqual(selectTreeIrFrondSites({ seed: 1 }, sites, 0), []);
});
