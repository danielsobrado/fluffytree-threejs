import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFoliageRepairBudget,
  resolveFoliageCoveragePolicy,
} from '../src/generation/foliage-coverage-policy.js';

const CONTINUITY = Object.freeze({
  shellCoverageRepairBudgetRatio: 0.10,
  shellCoverageEmergencyBudgetRatio: 0.24,
  shellCoverageRepairStopRatio: 0.5,
  shellCoverageRepairMaximumSubdivisionDepth: 4,
  shellCoverageCertificationMaximumSubdivisionDepth: 6,
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
    broad.emergencyRepairBudgetRatio,
    CONTINUITY.shellCoverageEmergencyBudgetRatio,
  );
  assert.equal(
    broad.stopCoverageRatio,
    CONTINUITY.shellCoverageRepairStopRatio,
  );
  assert.equal(
    broad.minimumDirectionDiameter,
    CONTINUITY.shellCoverageRepairMinimumDirectionDiameter,
  );
  assert.equal(
    broad.certificationMaximumSubdivisionDepth,
    CONTINUITY.shellCoverageCertificationMaximumSubdivisionDepth,
  );
  assert.ok(
    broad.certificationMinimumDirectionDiameter <
      broad.minimumDirectionDiameter,
  );
  assert.ok(sparse.repairBudgetRatio > broad.repairBudgetRatio);
  assert.ok(
    sparse.emergencyRepairBudgetRatio > broad.emergencyRepairBudgetRatio,
  );
  assert.ok(sparse.stopCoverageRatio < broad.stopCoverageRatio);
  assert.ok(sparse.minimumDirectionDiameter < broad.minimumDirectionDiameter);
  assert.ok(
    sparse.certificationMinimumDirectionDiameter <
      broad.certificationMinimumDirectionDiameter,
  );
  assert.equal(sparse.maximumSubdivisionDepth, broad.maximumSubdivisionDepth);
  assert.equal(
    sparse.certificationMaximumSubdivisionDepth,
    broad.certificationMaximumSubdivisionDepth,
  );
  assert.equal(sparse.maximumPasses, broad.maximumPasses);
});

test('adaptive repair budget is deterministic and bounded', () => {
  assert.equal(calculateFoliageRepairBudget(640, 0.10), 64);
  assert.equal(calculateFoliageRepairBudget(256, 0), 0);
  assert.equal(calculateFoliageRepairBudget(256, 1), 256);
});
