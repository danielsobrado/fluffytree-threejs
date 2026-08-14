import assert from 'node:assert/strict';
import test from 'node:test';
import { repairFoliageCoverage } from '../src/generation/foliage-coverage-repair.js';

function candidate(id, x, coverageRadius = 1, score = 0) {
  return {
    id,
    candidateIndex: id,
    lobeId: 0,
    position: { x, y: 0, z: 0 },
    surfacePoint: { x, y: 0, z: 0 },
    normal: { x: 0, y: 0, z: 1 },
    coverageRadius,
    exposure: 1,
    score,
  };
}

test('coverage repair adds only deterministic uncovered probes', () => {
  const selected = [candidate(0, 0)];
  const near = candidate(1, 0.4);
  const gap = candidate(2, 1.2);

  const result = repairFoliageCoverage(selected, [near, gap], {
    stopCoverageRatio: 0.5,
    verificationCandidates: [near, gap],
  });

  assert.deepEqual(result.additions, [gap]);
  assert.ok(result.maximumCoverageRatio <= 0.5);
});

test('coverage repair prefers wider cards to close a gap with fewer instances', () => {
  const narrow = candidate(1, 0, 0.4, 1);
  const wide = candidate(2, 0, 1, 0);

  const result = repairFoliageCoverage([], [narrow, wide], {
    stopCoverageRatio: 0.5,
  });

  assert.deepEqual(result.additions, [wide]);
  assert.equal(result.maximumCoverageRatio, 0);
});
