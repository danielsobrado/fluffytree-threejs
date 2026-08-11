import assert from 'node:assert/strict';
import test from 'node:test';
import { CrownVolumeQaRunner } from '../src/qa/crown-volume-qa-runner.js';

function createVolume() {
  return {
    positions: new Float32Array([
      0, 0, 0,
      1, 0, 0,
      0, 1, 0,
    ]),
    normals: new Float32Array([
      0, 0, 1,
      0, 0, 1,
      0, 0, 1,
    ]),
    vertexCount: 3,
    triangleCount: 1,
    grid: { cellSize: 1 },
  };
}

function createRunner() {
  return new CrownVolumeQaRunner({
    treeGenerator: { generate: () => ({}) },
    volumeGenerator: { generate: () => createVolume() },
  });
}

function createConfiguration(overrides = {}) {
  return {
    run: {
      seedStart: 1,
      seedCount: 2,
      deterministicReplayCount: 2,
    },
    thresholds: {
      minimumUniqueHashRate: 1,
      exact: {},
      ranges: {},
    },
    report: { metrics: ['triangleCount'] },
    ...overrides,
  };
}

test('aggregate uniqueness failure is not counted as a failed sample', () => {
  const report = createRunner().run(
    new Map([['tree', {}]]),
    createConfiguration(),
  );

  assert.equal(report.passed, false);
  assert.equal(report.summary.samplesAnalyzed, 2);
  assert.equal(report.summary.failedSampleCount, 0);
  assert.equal(report.summary.aggregateFailureCount, 1);
  assert.equal(report.presets.tree.failedSampleCount, 0);
  assert.equal(report.presets.tree.aggregateFailureCount, 1);
});

test('unknown report metrics fail instead of serializing NaN as null', () => {
  const configuration = createConfiguration({
    run: {
      seedStart: 1,
      seedCount: 1,
      deterministicReplayCount: 2,
    },
    thresholds: {
      minimumUniqueHashRate: 0,
      exact: {},
      ranges: {},
    },
    report: { metrics: ['missingMetric'] },
  });

  assert.throws(
    () => createRunner().run(new Map([['tree', {}]]), configuration),
    /missingMetric.*missing or not finite/,
  );
});
