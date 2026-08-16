import assert from 'node:assert/strict';
import test from 'node:test';
import { isFoliageCoverageCertified } from '../src/generation/foliage-adaptive-repair-runner.js';

function report(overrides = {}) {
  return {
    holes: [],
    unresolvedTriangleCount: 0,
    maximumCoverageRatio: 0.4,
    ...overrides,
  };
}

test('coverage certification requires holes, uncertainty and ratio to all pass', () => {
  assert.equal(isFoliageCoverageCertified(report(), 0.5), true);
  assert.equal(
    isFoliageCoverageCertified(report({ holes: [{}] }), 0.5),
    false,
  );
  assert.equal(
    isFoliageCoverageCertified(report({ unresolvedTriangleCount: 1 }), 0.5),
    false,
  );
  assert.equal(
    isFoliageCoverageCertified(report({ maximumCoverageRatio: 0.6 }), 0.5),
    false,
  );
});
