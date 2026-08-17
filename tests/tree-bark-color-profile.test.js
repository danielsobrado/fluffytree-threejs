import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateTreeBarkColorMix } from '../src/rendering/tree-bark-color-profile.js';
import { TREE_BARK_PATTERNS } from '../src/rendering/tree-bark-style-constants.js';

test('palm bark profile creates horizontal band contrast', () => {
  const common = {
    u: 0.25,
    phase: 0.7,
    treeHeight: 12,
    pattern: TREE_BARK_PATTERNS.PALM,
  };
  const samples = Array.from({ length: 18 }, (_unused, index) =>
    calculateTreeBarkColorMix({ ...common, v: index / 17 }),
  );
  const minimum = Math.min(...samples);
  const maximum = Math.max(...samples);

  assert.ok(maximum - minimum > 0.2);
  assert.ok(samples.every((value) => value >= 0 && value <= 1));
});

test('wood and palm bark profiles remain visually distinct', () => {
  const common = { u: 0.31, v: 0.57, phase: 1.2, treeHeight: 10 };
  const wood = calculateTreeBarkColorMix({
    ...common,
    pattern: TREE_BARK_PATTERNS.WOOD,
  });
  const palm = calculateTreeBarkColorMix({
    ...common,
    pattern: TREE_BARK_PATTERNS.PALM,
  });

  assert.notEqual(wood, palm);
});
