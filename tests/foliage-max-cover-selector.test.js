import assert from 'node:assert/strict';
import test from 'node:test';
import { selectDeterministicFoliageMaxCover } from '../src/generation/foliage-max-cover-selector.js';

function createItem(
  id,
  x,
  {
    lobeId = 0,
    score = 1 - id * 0.01,
    normal = { x: 0, y: 1, z: 0 },
    coverageRadius = 1.1,
  } = {},
) {
  return {
    id,
    candidateIndex: id,
    lobeId,
    score,
    exposure: score,
    position: { x, y: 0, z: 0 },
    normal,
    coverageRadius,
  };
}

test('selects the globally furthest uncovered candidate until every candidate is covered', () => {
  const items = [0, 1, 2, 3].map((x) => createItem(x, x));
  const result = selectDeterministicFoliageMaxCover(items);

  assert.deepEqual(
    result.selected.map((item) => item.id),
    [0, 3],
  );
  assert.ok(result.maximumCoverageRatio <= 1);
  assert.equal(result.worst.id, 1);
});

test('selection is independent from input order', () => {
  const items = [
    createItem(0, 0),
    createItem(1, 1),
    createItem(2, 2),
    createItem(3, 3),
  ];
  const forward = selectDeterministicFoliageMaxCover(items);
  const reverse = selectDeterministicFoliageMaxCover([...items].reverse());

  assert.deepEqual(
    forward.selected.map((item) => item.id),
    reverse.selected.map((item) => item.id),
  );
  assert.equal(forward.maximumCoverageRatio, reverse.maximumCoverageRatio);
});

test('direction-incompatible candidates cannot cover one another', () => {
  const items = [
    createItem(0, 0),
    createItem(1, 0.1, { normal: { x: 0, y: -1, z: 0 } }),
  ];
  const result = selectDeterministicFoliageMaxCover(items);

  assert.deepEqual(
    result.selected.map((item) => item.id),
    [0, 1],
  );
  assert.equal(result.maximumCoverageRatio, 0);
});

test('fixed-count reduction keeps one stable anchor per lobe', () => {
  const items = [
    createItem(0, 0, { lobeId: 0, score: 0.9 }),
    createItem(1, 2, { lobeId: 0, score: 0.4 }),
    createItem(2, 10, { lobeId: 1, score: 0.8 }),
    createItem(3, 12, { lobeId: 1, score: 0.3 }),
  ];
  const result = selectDeterministicFoliageMaxCover(items, {
    targetCount: 2,
    stopCoverageRatio: null,
    minimumPerLobe: true,
  });

  assert.deepEqual(
    result.selected.map((item) => item.id),
    [0, 2],
  );
});
