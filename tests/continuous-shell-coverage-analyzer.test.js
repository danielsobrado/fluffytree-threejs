import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeContinuousShellCoverage } from '../src/qa/continuous-shell-coverage-analyzer.js';

function createLobe(id = 0) {
  return {
    id,
    position: { x: 0, y: 0, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
  };
}

function createPreset() {
  return {
    foliage: {
      shell: {
        exposureThreshold: 0,
      },
    },
  };
}

function createTree(shell) {
  return {
    lobes: [createLobe()],
    shell,
  };
}

const TEST_OPTIONS = Object.freeze({
  maximumGapCardRatio: 0.9,
  maximumSubdivisionDepth: 4,
  minimumDirectionDiameter: 0.01,
  exposureMargin: 0,
  normalUncertaintyScale: 1,
  maximumFailureExamples: 4,
});

test('certifies a surface patch only when the complete patch is covered', () => {
  const tree = createTree([
    {
      id: 0,
      position: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      cardWidth: 4,
    },
  ]);
  const report = analyzeContinuousShellCoverage(tree, createPreset(), {
    ...TEST_OPTIONS,
    minimumCoverageNormalDot: -1,
  });

  assert.equal(report.passed, true);
  assert.equal(report.uncoveredTriangleCount, 0);
  assert.ok(report.coveredTriangleCount > 0);
  assert.ok(report.maximumGapCardRatioUpperBound <= 0.9);
});

test('rejects exposed surface when no leaf cluster can cover it', () => {
  const report = analyzeContinuousShellCoverage(
    createTree([]),
    createPreset(),
    {
      ...TEST_OPTIONS,
      maximumSubdivisionDepth: 2,
      minimumCoverageNormalDot: -1,
    },
  );

  assert.equal(report.passed, false);
  assert.ok(report.uncoveredTriangleCount > 0);
  assert.equal(report.maximumGapCardRatioUpperBound, Number.POSITIVE_INFINITY);
  assert.ok(report.failures.length > 0);
});

test('a card facing the opposite side cannot certify the complete sphere', () => {
  const tree = createTree([
    {
      id: 0,
      position: { x: 0, y: 1, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      cardWidth: 10,
    },
  ]);
  const report = analyzeContinuousShellCoverage(tree, createPreset(), {
    ...TEST_OPTIONS,
    maximumSubdivisionDepth: 3,
    minimumCoverageNormalDot: 0.2588,
  });

  assert.equal(report.passed, false);
  assert.ok(report.uncoveredTriangleCount > 0);
});

test('continuous coverage analysis is deterministic', () => {
  const tree = createTree([
    {
      id: 0,
      position: { x: 0, y: 0, z: 0 },
      normal: { x: 0, y: 1, z: 0 },
      cardWidth: 4,
    },
  ]);
  const first = analyzeContinuousShellCoverage(tree, createPreset(), {
    ...TEST_OPTIONS,
    minimumCoverageNormalDot: -1,
  });
  const second = analyzeContinuousShellCoverage(tree, createPreset(), {
    ...TEST_OPTIONS,
    minimumCoverageNormalDot: -1,
  });

  assert.deepEqual(first, second);
});
