import assert from 'node:assert/strict';
import test from 'node:test';
import { foliageCardCoverageRatio } from '../src/generation/foliage-card-coverage.js';
import { FoliageCoverageIndex } from '../src/generation/foliage-coverage-index.js';
import { SpatialHashGrid } from '../src/generation/spatial-hash-grid.js';
import { createFoliageAlphaProfile } from '../src/rendering/foliage-alpha-profile.js';

function createCluster(overrides = {}) {
  const profile = createFoliageAlphaProfile({
    shapeId: 'broadleaf',
    alphaTest: 0.46,
    planesPerCluster: 1,
  });

  return {
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    cardWidth: 1,
    coverageRadius: 1,
    leafShape: profile.shapeId,
    alphaTest: profile.alphaTest,
    planesPerCluster: profile.planesPerCluster,
    alphaProfile: profile,
    ...overrides,
  };
}

function createSimpleCluster(id, x, coverageRadius = 1) {
  return {
    id,
    position: { x, y: 0, z: 0 },
    normal: { x: 0, y: 1, z: 0 },
    coverageRadius,
  };
}

test('coverage index rejects points that land in transparent leaf pixels', () => {
  const index = new FoliageCoverageIndex(1);
  index.add(createCluster());

  const candidate = {
    position: { x: 0.48, y: 0.48, z: 0 },
    surfacePoint: { x: 0.48, y: 0.48, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  };

  assert.equal(index.nearestRatio(candidate), Number.POSITIVE_INFINITY);
});

test('coverage index keeps distance coverage for records without alpha metadata', () => {
  const index = new FoliageCoverageIndex(1);
  index.add({
    position: { x: 0, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    coverageRadius: 1,
  });

  const candidate = {
    position: { x: 0.25, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
  };

  assert.equal(index.nearestRatio(candidate), 0.25);
});

test('coverage index shell expansion matches a brute-force nearest ratio', () => {
  const selected = [
    createSimpleCluster(1, -4.2, 0.8),
    createSimpleCluster(2, -1.2, 1),
    createSimpleCluster(3, 0.65, 0.7),
    createSimpleCluster(4, 2.4, 0.9),
    createSimpleCluster(5, 6.1, 1),
  ];
  const candidate = createSimpleCluster(99, 0.1, 1);
  const index = new FoliageCoverageIndex(1);
  selected.forEach((entry) => index.add(entry));

  const expected = Math.min(
    ...selected.map((entry) => foliageCardCoverageRatio(candidate, entry)),
  );

  assert.equal(index.nearestRatio(candidate), expected);
});

test('coverage index rejects entries beyond its search-radius contract', () => {
  const index = new FoliageCoverageIndex(1);

  assert.throws(
    () => index.add(createSimpleCluster(1, 0, 1.01)),
    /exceeds the index maximum/,
  );
});

test('expanding spatial shells visit every searched cell exactly once', () => {
  const grid = new SpatialHashGrid(1);
  const entries = [];

  for (let x = -3; x <= 3; x += 1) {
    for (let y = -3; y <= 3; y += 1) {
      for (let z = -3; z <= 3; z += 1) {
        const entry = `${x}:${y}:${z}`;
        entries.push(entry);
        grid.insert({ x: x + 0.1, y: y + 0.1, z: z + 0.1 }, entry);
      }
    }
  }

  const visited = [];
  const collect = (entry) => {
    visited.push(entry);
    return false;
  };
  const origin = { x: 0.1, y: 0.1, z: 0.1 };
  grid.forEachNear(origin, 1, collect);
  grid.forEachShell(origin, 2, collect);
  grid.forEachShell(origin, 3, collect);

  assert.equal(visited.length, entries.length);
  assert.equal(new Set(visited).size, entries.length);
  assert.deepEqual(new Set(visited), new Set(entries));
});

test('spatial shell queries reject invalid ring counts', () => {
  const grid = new SpatialHashGrid(1);

  assert.throws(() => grid.forEachShell({ x: 0, y: 0, z: 0 }, 0, () => false));
  assert.throws(() => grid.forEachShell({ x: 0, y: 0, z: 0 }, 1.5, () => false));
});
