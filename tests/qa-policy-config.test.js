import assert from 'node:assert/strict';
import test from 'node:test';
import { parseShellCoverageQaConfig } from '../src/qa/shell-coverage-qa-config.js';
import { parseTreeStressQaPolicy } from '../src/qa/tree-stress-qa-policy.js';
import { parseTreeLodQaPolicy } from '../tools/tree-lod-qa-policy.js';

function lodPolicy(overrides = {}) {
  return {
    budgets: {
      maximumTriangles: [25000, 8000, 2000, 2],
      maximumDrawCalls: [5, 4, 2, 1],
      maximumShadowTriangles: 2000,
    },
    sweep: {
      seedCount: 24,
      firstSeed: 90001,
      seedStep: 7919,
    },
    ...overrides,
  };
}

function stressPolicy(overrides = {}) {
  return {
    expectedTreeCount: 75,
    maximumColorDrawCalls: 100,
    maximumGpuMegabytes: 128,
    targetFps: 30,
    fpsRequiresTargetHardware: true,
    ...overrides,
  };
}

function coveragePolicy(overrides = {}) {
  return {
    run: { seedCount: 24, firstSeed: 90001, seedStep: 7919 },
    probe: {
      probeDensityMultiplier: 2,
      probeExposureMargin: 0.05,
      continuous: {
        maximumCoverageRatio: 1,
        maximumSubdivisionDepth: 8,
        minimumDirectionDiameter: 0.004,
        exposureMargin: 0.05,
        normalUncertaintyScale: 1,
        minimumCoverageNormalDot: 0.2588,
        maximumFailureExamples: 12,
      },
    },
    thresholds: {
      roundOrchard: {
        maximumCandidateCoverageRatio: 1.000001,
        gapCardRatio: 0.85,
        minimumLeafAreaIndex: 6.5,
        bareExposedLobes: 0,
      },
    },
    report: { maxFailures: 6 },
    ...overrides,
  };
}

test('LOD QA policy validates budgets and sweep seeds', () => {
  const parsed = parseTreeLodQaPolicy(lodPolicy());
  assert.deepEqual(parsed.budgets.maximumTriangles, [25000, 8000, 2000, 2]);
  assert.equal(parsed.sweep.firstSeed, 90001);

  assert.throws(
    () =>
      parseTreeLodQaPolicy(
        lodPolicy({
          budgets: {
            ...lodPolicy().budgets,
            maximumDrawCalls: [5, 4, 2],
          },
        }),
      ),
    /exactly 4 values/,
  );
  assert.throws(
    () =>
      parseTreeLodQaPolicy(
        lodPolicy({ sweep: { ...lodPolicy().sweep, firstSeed: -1 } }),
      ),
    /unsigned 32-bit integer/,
  );
  assert.throws(
    () =>
      parseTreeLodQaPolicy(
        lodPolicy({ sweep: { ...lodPolicy().sweep, seedStep: 0x100000000 } }),
      ),
    /unsigned 32-bit integer/,
  );
});

test('stress QA policy rejects invalid acceptance thresholds', () => {
  assert.equal(parseTreeStressQaPolicy(stressPolicy()).expectedTreeCount, 75);

  assert.throws(
    () => parseTreeStressQaPolicy(stressPolicy({ maximumGpuMegabytes: 0 })),
    /finite number > 0/,
  );
  assert.throws(
    () =>
      parseTreeStressQaPolicy(
        stressPolicy({ fpsRequiresTargetHardware: 'yes' }),
      ),
    /must be a boolean/,
  );
});

test('shell coverage QA config validates the shared sweep and probe policy', () => {
  const parsed = parseShellCoverageQaConfig(coveragePolicy());
  assert.equal(parsed.run.seedCount, 24);
  assert.equal(parsed.probe.continuous.minimumDirectionDiameter, 0.004);
  assert.equal(parsed.thresholds.roundOrchard.gapCardRatio, 0.85);

  assert.throws(
    () =>
      parseShellCoverageQaConfig(
        coveragePolicy({
          run: { ...coveragePolicy().run, seedStep: 0x100000000 },
        }),
      ),
    /unsigned 32-bit integer/,
  );
  assert.throws(
    () =>
      parseShellCoverageQaConfig(
        coveragePolicy({
          probe: {
            ...coveragePolicy().probe,
            continuous: {
              ...coveragePolicy().probe.continuous,
              minimumCoverageNormalDot: 2,
            },
          },
        }),
      ),
    /within \[-1, 1\]/,
  );
});
