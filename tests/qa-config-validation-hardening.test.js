import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseQaExactMap,
  parseQaRangeMap,
} from '../src/qa/qa-config-validation.js';

test('exact QA gate maps cannot be empty', () => {
  assert.throws(
    () => parseQaExactMap({}, 'qa.exact'),
    /qa\.exact.*must not be empty/,
  );
});

test('range QA gate maps cannot be empty', () => {
  assert.throws(
    () => parseQaRangeMap({}, 'qa.ranges'),
    /qa\.ranges.*must not be empty/,
  );
});
