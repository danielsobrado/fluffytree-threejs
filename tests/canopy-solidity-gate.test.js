import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateSolidityReport,
  evaluateSolidityView,
  summarizeViewMetrics,
} from '../src/qa/canopy-solidity-gate.js';

const THRESHOLDS = Object.freeze({
  roundOrchard: {
    crown: {
      holeRatio: 0.003,
      largestHoleRatio: 0.002,
      coverageRatio: 0.04,
      coverageRetention: 0.8,
    },
    base: { holeRatio: 0.001, largestHoleRatio: 0.001, coverageRatio: 0.04 },
  },
});

function createView(overrides = {}) {
  return {
    group: 'crown',
    name: 'y27e10',
    lodState: 'lod0',
    holeRatio: 0,
    largestHoleRatio: 0,
    coverageRatio: 0.2,
    coverageRetention: 1,
    holeCount: 0,
    largestHolePixels: 0,
    ...overrides,
  };
}

test('a solid view passes every gated metric', () => {
  assert.deepEqual(
    evaluateSolidityView(createView(), THRESHOLDS.roundOrchard.crown),
    [],
  );
});

test('a see-through view fails on both hole metrics', () => {
  const failures = evaluateSolidityView(
    createView({ lodState: 'lod1-lod2', holeRatio: 0.09, largestHoleRatio: 0.05 }),
    THRESHOLDS.roundOrchard.crown,
  );

  assert.equal(failures.length, 2);
  assert.match(
    failures[0],
    /crown\/lod1-lod2\/y27e10 holeRatio 0\.09000 > 0\.00300/,
  );
  assert.match(failures[1], /largestHoleRatio/);
});

test('coverage is gated as a minimum rather than a maximum', () => {
  assert.deepEqual(
    evaluateSolidityView(
      createView({ coverageRatio: 0.9 }),
      THRESHOLDS.roundOrchard.crown,
    ),
    [],
  );
  const failures = evaluateSolidityView(
    createView({ coverageRatio: 0.001 }),
    THRESHOLDS.roundOrchard.crown,
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /coverageRatio 0\.00100 < 0\.04000/);
});

test('a reduced LOD fails when its projected canopy becomes too thin', () => {
  const failures = evaluateSolidityView(
    createView({ lodState: 'lod2', coverageRetention: 0.63 }),
    THRESHOLDS.roundOrchard.crown,
  );

  assert.equal(failures.length, 1);
  assert.match(
    failures[0],
    /crown\/lod2\/y27e10 coverageRetention 0\.63000 < 0\.80000/,
  );
});

test('missing or non-finite gated metrics fail explicitly', () => {
  const failures = evaluateSolidityView(
    createView({ coverageRetention: undefined }),
    THRESHOLDS.roundOrchard.crown,
  );

  assert.deepEqual(failures, [
    'crown/lod0/y27e10 coverageRetention is not finite',
  ]);
});

test('missing thresholds fail rather than silently pass', () => {
  const withoutPreset = evaluateSolidityReport(
    [{ presetId: 'unknown', views: [createView()] }],
    THRESHOLDS,
  );
  assert.equal(withoutPreset.length, 1);
  assert.match(withoutPreset[0], /Missing canopy solidity thresholds/);

  const withoutGroup = evaluateSolidityReport(
    [{ presetId: 'roundOrchard', views: [createView({ group: 'canopy' })] }],
    THRESHOLDS,
  );
  assert.equal(withoutGroup.length, 1);
  assert.match(withoutGroup[0], /Missing 'canopy' solidity thresholds/);
});

test('report failures name the preset, LOD state, and view', () => {
  const failures = evaluateSolidityReport(
    [
      {
        presetId: 'roundOrchard',
        views: [
          createView(),
          createView({
            group: 'base',
            name: 'y41e26',
            holeRatio: 0.02,
            coverageRetention: undefined,
          }),
        ],
      },
    ],
    THRESHOLDS,
  );

  assert.equal(failures.length, 1);
  assert.match(failures[0], /^roundOrchard base\/lod0\/y41e26 holeRatio/);
});

test('view metrics summarize only finite values across the orbit', () => {
  const summary = summarizeViewMetrics([
    createView({
      holeRatio: 0.01,
      coverageRatio: 0.2,
      coverageRetention: 1,
      holeCount: 2,
    }),
    createView({
      holeRatio: 0.03,
      coverageRatio: 0.1,
      coverageRetention: 0.75,
      holeCount: 4,
    }),
    createView({ coverageRetention: undefined }),
  ]);

  assert.equal(summary.holeRatio.maximum, 0.03);
  assert.equal(summary.holeRatio.minimum, 0);
  assert.ok(Math.abs(summary.holeRatio.mean - 0.04 / 3) < 1e-9);
  assert.equal(summary.coverageRatio.minimum, 0.1);
  assert.equal(summary.coverageRetention.minimum, 0.75);
  assert.equal(summary.coverageRetention.maximum, 1);
  assert.equal(summary.holeCount.maximum, 4);
});
