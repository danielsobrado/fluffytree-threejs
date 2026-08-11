import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateSolidityReport,
  evaluateSolidityView,
} from '../src/qa/canopy-solidity-gate.js';

function createView(overrides = {}) {
  return {
    group: 'crown',
    name: 'view',
    lodState: 'lod0',
    holeRatio: 0,
    largestHoleRatio: 0,
    coverageRatio: 0.2,
    coverageRetention: 1,
    ...overrides,
  };
}

test('crown solidity checks cannot be disabled by omitting a metric threshold', () => {
  const failures = evaluateSolidityView(createView(), {
    holeRatio: 0.003,
    largestHoleRatio: 0.002,
    coverageRatio: 0.04,
  });

  assert.deepEqual(failures, [
    'crown/lod0/view coverageRetention threshold is missing',
  ]);
});

test('base solidity does not require crown-only coverage retention', () => {
  const failures = evaluateSolidityView(createView({ group: 'base' }), {
    holeRatio: 0.003,
    largestHoleRatio: 0.002,
    coverageRatio: 0.04,
  });

  assert.deepEqual(failures, []);
});

test('wind gate cannot be disabled by omitting its threshold', () => {
  const failures = evaluateSolidityReport(
    [
      {
        presetId: 'tree',
        windMovedRatio: 0.2,
        views: [createView()],
      },
    ],
    {
      tree: {
        crown: {
          holeRatio: 0.003,
          largestHoleRatio: 0.002,
          coverageRatio: 0.04,
          coverageRetention: 0.8,
        },
      },
    },
  );

  assert.deepEqual(failures, [
    'tree minimumWindMovedRatio threshold is missing',
  ]);
});
