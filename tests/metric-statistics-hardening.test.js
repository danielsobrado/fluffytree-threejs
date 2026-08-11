import assert from 'node:assert/strict';
import test from 'node:test';
import {
  findWorstSeeds,
  summarizeMetrics,
} from '../src/qa/metric-statistics.js';

test('metric summaries reject empty input', () => {
  assert.throws(() => summarizeMetrics([]), /at least one row/);
  assert.throws(() => findWorstSeeds([], ['value']), /at least one metric row/);
});

test('metric summaries reject later non-finite values', () => {
  assert.throws(
    () =>
      summarizeMetrics([
        { seed: 1, value: 1 },
        { seed: 2, value: Number.NaN },
      ]),
    /value.*missing or not finite/,
  );
});

test('worst-seed reports reject missing configured metrics', () => {
  assert.throws(
    () => findWorstSeeds([{ seed: 1, value: 1 }], ['missing']),
    /missing.*missing or not finite/,
  );
});

test('finite metrics still summarize and rank normally', () => {
  const rows = [
    { seed: 1, value: 4 },
    { seed: 2, value: 2 },
    { seed: 3, value: 6 },
  ];
  const summary = summarizeMetrics(rows);
  const worst = findWorstSeeds(rows, ['value']);

  assert.equal(summary.value.minimum, 2);
  assert.equal(summary.value.maximum, 6);
  assert.equal(summary.value.mean, 4);
  assert.deepEqual(worst.value.minimum, { seed: 2, value: 2 });
  assert.deepEqual(worst.value.maximum, { seed: 3, value: 6 });
});
