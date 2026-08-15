import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectAdaptiveFoliageCoverage,
} from '../src/generation/adaptive-foliage-coverage-repair.js';

function createLobe() {
  return {
    id: 0,
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

function createCluster(id, normal, coverageRadius = 4) {
  return {
    id,
    lobeId: 0,
    position: { x: 0, y: 0, z: 0 },
    surfacePoint: { x: 0, y: 0, z: 0 },
    normal,
    coverageRadius,
  };
}

const OPTIONS = Object.freeze({
  stopCoverageRatio: 0.5,
  exposureThreshold: 0,
  maximumSubdivisionDepth: 3,
  minimumDirectionDiameter: 0.02,
  normalUncertaintyScale: 1,
  maximumHolesPerLobe: 12,
});

test('adaptive coverage reports no holes when directional coverage encloses the lobe', () => {
  const clusters = [
    createCluster(0, { x: 1, y: 0, z: 0 }),
    createCluster(1, { x: -1, y: 0, z: 0 }),
    createCluster(2, { x: 0, y: 1, z: 0 }),
    createCluster(3, { x: 0, y: -1, z: 0 }),
    createCluster(4, { x: 0, y: 0, z: 1 }),
    createCluster(5, { x: 0, y: 0, z: -1 }),
  ];

  const report = inspectAdaptiveFoliageCoverage(
    clusters,
    [createLobe()],
    OPTIONS,
  );

  assert.equal(report.holes.length, 0);
  assert.equal(report.unresolvedTriangleCount, 0);
  assert.ok(report.certifiedTriangleCount > 0);
});

test('adaptive coverage localizes exposed holes and respects the repair budget', () => {
  const report = inspectAdaptiveFoliageCoverage(
    [createCluster(0, { x: 0, y: 1, z: 0 }, 0.2)],
    [createLobe()],
    { ...OPTIONS, maximumHolesPerLobe: 5 },
  );

  assert.ok(report.holes.length > 0);
  assert.ok(report.holes.length <= 5);
  assert.ok(
    report.holes.every(
      (hole) => hole.lobeId === 0 && hole.coverageRatio > OPTIONS.stopCoverageRatio,
    ),
  );
});

test('adaptive coverage inspection is deterministic', () => {
  const clusters = [createCluster(0, { x: 0, y: 1, z: 0 }, 0.2)];
  const lobes = [createLobe()];
  const first = inspectAdaptiveFoliageCoverage(clusters, lobes, OPTIONS);
  const second = inspectAdaptiveFoliageCoverage(clusters, lobes, OPTIONS);

  assert.deepEqual(first, second);
});

test('terminal exposed patches request reinforcement when coverage is not certifiable', () => {
  const clusters = [
    createCluster(0, { x: 1, y: 0, z: 0 }, 2),
    createCluster(1, { x: -1, y: 0, z: 0 }, 2),
    createCluster(2, { x: 0, y: 1, z: 0 }, 2),
    createCluster(3, { x: 0, y: -1, z: 0 }, 2),
    createCluster(4, { x: 0, y: 0, z: 1 }, 2),
    createCluster(5, { x: 0, y: 0, z: -1 }, 2),
  ];
  const report = inspectAdaptiveFoliageCoverage(
    clusters,
    [createLobe()],
    { ...OPTIONS, maximumSubdivisionDepth: 0 },
  );

  assert.ok(report.unresolvedTriangleCount > 0);
  assert.ok(report.holes.length > 0);
  assert.ok(report.holes.every((hole) => hole.kind === 'uncertified'));
  assert.ok(report.holes.every((hole) => hole.exposure >= OPTIONS.exposureThreshold));
});
