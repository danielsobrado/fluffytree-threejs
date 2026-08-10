import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTreeLodQaPolicy } from '../tools/tree-lod-qa-policy.js';
import { parseTreeStressQaPolicy } from '../tools/tree-stress-qa-policy.js';

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
