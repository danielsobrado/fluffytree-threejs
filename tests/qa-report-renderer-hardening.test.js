import assert from 'node:assert/strict';
import test from 'node:test';
import { renderQaMarkdown } from '../src/qa/qa-report-renderer.js';

function createReport(metricValue = 1) {
  return {
    passed: true,
    configuration: {
      seedStart: 1,
      seedCount: 1,
      silhouetteResolution: 64,
      volumeResolution: 14,
      deterministicReplayCount: 2,
    },
    summary: { treesAnalyzed: 1, presetCount: 1 },
    presets: {
      tree: {
        label: 'Tree',
        profile: 'round',
        passed: true,
        treesAnalyzed: 1,
        failedTreeCount: 0,
        uniqueTreeCount: 1,
        deterministicMismatchCount: 0,
        gateFailureCounts: {},
        metrics: {
          value: {
            minimum: metricValue,
            p05: metricValue,
            p50: metricValue,
            p95: metricValue,
            maximum: metricValue,
            mean: metricValue,
          },
        },
      },
    },
  };
}

test('QA markdown rejects missing configured summary metrics', () => {
  assert.throws(
    () => renderQaMarkdown(createReport(), ['missing']),
    /missing configured summary metric 'missing'/,
  );
});

test('QA markdown rejects non-finite metric values', () => {
  assert.throws(
    () => renderQaMarkdown(createReport(Number.NaN), ['value']),
    /non-finite metric value/,
  );
});

test('QA markdown renders valid configured metrics', () => {
  const markdown = renderQaMarkdown(createReport(1.25), ['value']);
  assert.match(markdown, /\| value \| 1\.2500/);
});
