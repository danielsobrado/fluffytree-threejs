import assert from 'node:assert/strict';
import test from 'node:test';
import { createCrownSummary } from '../src/generation/crown-summary.js';

test('crown summary returns the mean lobe position', () => {
  const summary = createCrownSummary([
    { position: { x: -2, y: 3, z: 1 } },
    { position: { x: 2, y: 5, z: -1 } },
    { position: { x: 3, y: 7, z: 3 } },
  ]);

  assert.deepEqual(summary.center, { x: 1, y: 5, z: 1 });
  assert.ok(Object.isFrozen(summary));
  assert.ok(Object.isFrozen(summary.center));
});

test('crown summary rejects an empty crown', () => {
  assert.throws(
    () => createCrownSummary([]),
    /requires at least one foliage lobe/,
  );
});
