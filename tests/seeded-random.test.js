import assert from 'node:assert/strict';
import test from 'node:test';
import { SeededRandom } from '../src/generation/seeded-random.js';

test('zero is a real deterministic seed rather than a fallback alias', () => {
  const zero = new SeededRandom(0);
  const formerFallback = new SeededRandom(0x6d2b79f5);

  assert.notEqual(zero.next(), formerFallback.next());
  assert.equal(new SeededRandom(0).next(), new SeededRandom(0).next());
});

test('random seeds reject values that would truncate or wrap', () => {
  for (const seed of [-1, 1.5, 0x100000000, Number.POSITIVE_INFINITY, '12']) {
    assert.throws(
      () => new SeededRandom(seed),
      /unsigned 32-bit integer/,
      String(seed),
    );
  }
});
