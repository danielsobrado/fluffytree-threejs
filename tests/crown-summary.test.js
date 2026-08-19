import assert from 'node:assert/strict';
import test from 'node:test';
import { createCrownSummary } from '../src/generation/crown-summary.js';

function createLobe(x, y, z, radius) {
  return {
    position: { x, y, z },
    scale: { x: radius, y: radius, z: radius },
  };
}

test('crown summary returns the mean lobe position', () => {
  const summary = createCrownSummary([
    createLobe(-2, 3, 1, 1),
    createLobe(2, 5, -1, 1),
    createLobe(3, 7, 3, 1),
  ]);

  assert.deepEqual(summary.center, { x: 1, y: 5, z: 1 });
  assert.ok(Object.isFrozen(summary));
  assert.ok(Object.isFrozen(summary.center));
});

test('crown summary reports the lowest point any lobe reaches', () => {
  const summary = createCrownSummary([
    createLobe(0, 4, 0, 1.5),
    createLobe(0, 3, 0, 0.75),
    createLobe(0, 6, 0, 2),
  ]);

  assert.equal(summary.base, 2.25);
});

test('crown summary rejects an empty crown', () => {
  assert.throws(
    () => createCrownSummary([]),
    /requires at least one foliage lobe/,
  );
});
