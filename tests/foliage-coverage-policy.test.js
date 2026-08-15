import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateFoliageRepairProbeCount,
  resolveFoliageCoveragePolicy,
} from '../src/generation/foliage-coverage-policy.js';

const CONTINUITY = Object.freeze({
  shellCoverageRepairProbeRatio: 0.2,
  shellCoverageRepairStopRatio: 0.5,
});

test('sparser alpha shapes receive more probes and tighter overlap', () => {
  const broad = resolveFoliageCoveragePolicy(
    { opaqueAreaRatio: 0.425 },
    CONTINUITY,
  );
  const sparse = resolveFoliageCoveragePolicy(
    { opaqueAreaRatio: 0.32 },
    CONTINUITY,
  );

  assert.equal(broad.probeRatio, CONTINUITY.shellCoverageRepairProbeRatio);
  assert.equal(
    broad.stopCoverageRatio,
    CONTINUITY.shellCoverageRepairStopRatio,
  );
  assert.ok(sparse.probeRatio > broad.probeRatio);
  assert.ok(sparse.stopCoverageRatio < broad.stopCoverageRatio);
  assert.equal(sparse.passCount, broad.passCount);
});

test('repair probe count is deterministic and bounded', () => {
  assert.equal(calculateFoliageRepairProbeCount(256, 0.2), 52);
  assert.equal(calculateFoliageRepairProbeCount(256, 0), 0);
  assert.equal(calculateFoliageRepairProbeCount(256, 1), 256);
});
