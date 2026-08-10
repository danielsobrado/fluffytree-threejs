import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateTuningCoverage,
  tuningCoverageAutoFitTargets,
} from '../src/ui/tuning-coverage-policy.js';

const thresholds = Object.freeze({
  maximumCandidateCoverageRatio: 1.000001,
  gapCardRatio: 0.85,
  minimumLeafAreaIndex: 6.5,
  bareExposedLobes: 0,
});

function report(overrides = {}) {
  return {
    candidateCoverageRatio: 1,
    gapCardRatio: 0.8,
    leafAreaIndex: 7,
    bareExposedLobes: 0,
    continuous: { passed: true },
    ...overrides,
  };
}

test('studio coverage requires every configured coverage gate to pass', () => {
  assert.equal(evaluateTuningCoverage(report(), thresholds).passed, true);

  assert.equal(
    evaluateTuningCoverage(report({ candidateCoverageRatio: 1.1 }), thresholds)
      .passed,
    false,
  );
  assert.equal(
    evaluateTuningCoverage(report({ continuous: { passed: false } }), thresholds)
      .passed,
    false,
  );
  assert.equal(
    evaluateTuningCoverage(report({ gapCardRatio: 0.9 }), thresholds).passed,
    false,
  );
});

test('auto-fit targets stay inside the configured gate thresholds', () => {
  const targets = tuningCoverageAutoFitTargets(thresholds);
  assert.ok(targets.gapCardRatio < thresholds.gapCardRatio);
  assert.ok(targets.minimumLeafAreaIndex > thresholds.minimumLeafAreaIndex);
});

test('studio coverage rejects missing preset thresholds', () => {
  assert.throws(
    () => evaluateTuningCoverage(report(), null, 'missingPreset'),
    /Missing studio coverage thresholds.*missingPreset/,
  );
});
