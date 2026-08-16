import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertCanonicalValue,
  hashCanonicalValue,
} from '../src/core/canonical-value-hash.js';

test('canonical hashes are independent from object key insertion order', () => {
  const first = { b: 2, a: { y: true, x: [1, 'two'] } };
  const second = { a: { x: [1, 'two'], y: true }, b: 2 };

  assert.equal(hashCanonicalValue(first), hashCanonicalValue(second));
});

test('canonical hashes change with values and array order', () => {
  assert.notEqual(hashCanonicalValue({ value: 1 }), hashCanonicalValue({ value: 2 }));
  assert.notEqual(hashCanonicalValue([1, 2]), hashCanonicalValue([2, 1]));
});

test('canonical values reject unsupported data and cycles', () => {
  assert.throws(
    () => assertCanonicalValue({ work() {} }),
    /canonical serializable data/,
  );
  const cycle = {};
  cycle.self = cycle;
  assert.throws(() => hashCanonicalValue(cycle), /cycle/);
});
