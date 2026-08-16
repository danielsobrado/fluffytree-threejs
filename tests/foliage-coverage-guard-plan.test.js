import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFoliageCoverageGuard } from '../src/rendering/foliage-coverage-guard-plan.js';

test('coverage guard restores only planes omitted by a reduced LOD', () => {
  const instances = [
    { id: 1, planesPerCluster: 2 },
    { id: 2, planesPerCluster: 2, coverageRepairKind: 'witnessed' },
    { id: 3, planesPerCluster: 2, coverageRepairKind: 'uncertified' },
  ];
  const guard = resolveFoliageCoverageGuard(instances, 1);

  assert.deepEqual(
    guard.repairInstances.map((instance) => instance.id),
    [2, 3],
  );
  assert.equal(guard.firstPlaneIndex, 1);
  assert.equal(guard.planeCount, 1);
  assert.equal(guard.certifiedPlaneCount, 2);
});

test('coverage guard is empty when the LOD already renders certified planes', () => {
  const instances = [
    { id: 1, planesPerCluster: 2, coverageRepairKind: 'witnessed' },
  ];
  const guard = resolveFoliageCoverageGuard(instances, 2);

  assert.equal(guard.repairInstances.length, 1);
  assert.equal(guard.planeCount, 0);
  assert.equal(guard.certifiedPlaneCount, 2);
});

test('coverage guard rejects invalid inputs', () => {
  assert.throws(() => resolveFoliageCoverageGuard(null, 1), TypeError);
  assert.throws(() => resolveFoliageCoverageGuard([], 0), RangeError);
});
