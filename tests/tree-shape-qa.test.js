import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeShapeQaRunner } from '../src/qa/tree-shape-qa-runner.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const configuration = {
  run: { seedStart: 1, seedCount: 16, deterministicReplayCount: 2 },
  analysis: {
    silhouetteResolution: 32,
    volumeResolution: 8,
    profileSampleCount: 24,
  },
  thresholds: {
    aggregate: { maximumFailureRate: 0, minimumUniqueHashRate: 1 },
    common: {
      exact: {
        nonFiniteValueCount: 0,
        lobeComponentCount: 1,
        isolatedLobeCount: 0,
        missingBranchTargetCount: 0,
        nonMonotonicTrunkSegments: 0,
        silhouetteComponentCount: 1,
        shellMissingSourceLobeCount: 0,
        shellDuplicatePositionCount: 0,
      },
      ranges: {
        minimumBranchInsertion: [0.54, 0.56],
        maximumBranchInsertion: [0.54, 0.56],
        trunkTopFoliageDistance: [0, 1],
        silhouetteLargestComponentRatio: [0.99, 1],
        silhouetteHoleRatio: [0, 0.05],
        minimumColorMix: [0, 1],
        maximumColorMix: [0, 1],
        shellMinimumSurfaceDistance: [1, 1.3],
        shellMaximumSurfaceDistance: [1, 1.3],
        shellMeanSurfaceDistance: [1, 1.3],
        shellMaximumNormalLengthError: [0, 0.00000001],
        shellMinimumOutwardAlignment: [0, 1],
        shellMeanOutwardAlignment: [0, 1],
        shellMinimumExposure: [0, 1],
        shellMeanExposure: [0, 1],
        shellMaximumExposure: [0, 1],
        shellOccludedRatio: [0, 1],
        shellMinimumScale: [0, 1],
        shellMaximumScale: [0, 1],
        lobeMinimumExposure: [0, 1],
        lobeMeanExposure: [0, 1],
        lobeMaximumExposure: [0, 1],
        shellSilhouetteContribution: [0, 1],
        shellSilhouetteLargestComponentRatio: [0.98, 1],
        shellSilhouetteHoleRatio: [0, 0.1],
      },
    },
    profiles: {
      round: {
        minimumVerticalBandCounts: [2, 2, 2],
        ranges: {
          crownAspectRatio: [0.8, 1.8],
          widthDepthRatio: [0.5, 1.8],
          silhouetteFillRatio: [0.45, 0.9],
          targetCoverage: [0.5, 1],
          silhouetteExcessRatio: [0, 0.3],
          profileRmse: [0, 0.4],
          profileCorrelation: [-0.2, 1],
          envelopeCoverage: [0.2, 0.8],
          unionSpillRatio: [0, 0.3],
          upperLowerWidthRatio: [0.5, 2],
          middleLowerWidthRatio: [0.5, 2],
          middleUpperWidthRatio: [0.5, 2],
        },
      },
    },
  },
  report: {
    maximumFailureExamples: 5,
    worstSeedMetrics: ['crownAspectRatio', 'shellMeanExposure'],
  },
};

test('shape QA report is deterministic and passes a healthy preset', () => {
  const presets = new Map([['test', createTestPreset()]]);
  const runner = new TreeShapeQaRunner();
  const first = runner.run(presets, configuration);
  const second = runner.run(presets, configuration);

  assert.deepEqual(first, second);
  assert.equal(
    first.passed,
    true,
    JSON.stringify(first.presets.test.failureExamples, null, 2),
  );
  assert.equal(first.summary.treesAnalyzed, 16);
  assert.equal(first.presets.test.uniqueTreeCount, 16);
});
