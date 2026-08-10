import assert from 'node:assert/strict';
import test from 'node:test';
import { FOLIAGE_SHELL_CONSTANTS } from '../src/generation/foliage-shell-constants.js';
import { evaluateShellCoverageQa } from '../src/qa/shell-coverage-qa-evaluator.js';

const thresholds = Object.freeze({
  maximumCandidateCoverageRatio: 1.000001,
  gapCardRatio: 0.85,
  minimumLeafAreaIndex: 6.5,
  bareExposedLobes: 0,
});

function report(overrides = {}) {
  return {
    candidateCoverageRatio: 1,
    maximumPhysicalCoverageRatio:
      FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio,
    gapCardRatio: 0.8,
    leafAreaIndex: 7,
    bareExposedLobes: 0,
    continuous: {
      passed: true,
      uncoveredTriangleCount: 0,
      maximumDepthReached: 2,
    },
    ...overrides,
  };
}

test('shared shell coverage evaluator accepts a fully passing report', () => {
  const evaluation = evaluateShellCoverageQa(report(), thresholds);
  assert.equal(evaluation.passed, true);
  assert.deepEqual(evaluation.failures, []);
});

test('shared shell coverage evaluator reports every failing gate', () => {
  const evaluation = evaluateShellCoverageQa(
    report({
      candidateCoverageRatio: 1.1,
      maximumPhysicalCoverageRatio:
        FOLIAGE_SHELL_CONSTANTS.maximumPhysicalCoverageCardRatio + 0.1,
      gapCardRatio: 0.9,
      leafAreaIndex: 6,
      bareExposedLobes: 1,
      continuous: {
        passed: false,
        uncoveredTriangleCount: 3,
        maximumDepthReached: 8,
      },
    }),
    thresholds,
  );

  assert.equal(evaluation.passed, false);
  assert.equal(evaluation.failures.length, 6);
  assert.equal(evaluation.checks.physicalCoverage, false);
  assert.equal(evaluation.checks.continuousCoverage, false);
});
