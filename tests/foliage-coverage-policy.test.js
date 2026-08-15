import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFoliageRepairBudget,
  resolveFoliageCoveragePolicy,
} from '../src/generation/foliage-coverage-policy.js';

const CONTINUITY = Object.freeze({
  shellCoverageRepairBudgetRatio: 0.10,
  shellCoverageRepairStopRatio: 0.5,
  shellCoverageRepairMaximumSubdivisionDepth: 4,
  shellCoverageRepairMinimumDirectionDiameter: 0.055,
  shellCoverageRepairPasses: 2,
  shellCoverageRepairNormalUncertaintyScale: 1,
});

test('sparser alpha shapes receive more adaptive budget and tighter certification', () => {
  const broad = resolveFoliageCoveragePolicy(
    { opaqueAreaRatio: 0.425 },
    CONTINUITY,
  );
  const sparse = resolveFoliageCoveragePolicy(
    { opaqueAreaRatio: 0.32 },
    CONTINUITY,
  );

  assert.equal(
    broad.repairBudgetRatio,
    CONTINUITY.shellCoverageRepairBudgetRatio,
  );
  assert.equal(
    broad.stopCoverageRatio,
    CONTINUITY.shellCoverageRepairStopRatio,
  );
  assert.equal(
    broad.minimumDirectionDiameter,
    CONTINUITY.shellCoverageRepairMinimumDirectionDiameter,
  );
  assert.ok(sparse.repairBudgetRatio > broad.repairBudgetRatio);
  assert.ok(sparse.stopCoverageRatio < broad.stopCoverageRatio);
  assert.ok(sparse.minimumDirectionDiameter < broad.minimumDirectionDiameter);
  assert.equal(sparse.maximumSubdivisionDepth, broad.maximumSubdivisionDepth);
  assert.equal(sparse.maximumPasses, broad.maximumPasses);
});

test('adaptive repair budget is deterministic and bounded', () => {
  assert.equal(calculateFoliageRepairBudget(640, 0.10), 64);
  assert.equal(calculateFoliageRepairBudget(256, 0), 0);
  assert.equal(calculateFoliageRepairBudget(256, 1), 256);
});
