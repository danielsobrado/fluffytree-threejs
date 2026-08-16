import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveFoliageContinuityProfile } from '../src/domain/foliage-continuity-config.js';

test('continuity configuration resolves profile overrides over safe defaults', () => {
  const policy = resolveFoliageContinuityProfile(
    {
      profiles: {
        columnar: {
          verticalBias: 0.5,
          maximumShellCardWidthSpread: 1.8,
          shellCoverageRepairBudgetRatio: 0.09,
          shellCoverageEmergencyBudgetRatio: 0.21,
          shellCoverageRepairStopRatio: 0.46,
          shellCoverageRepairMaximumSubdivisionDepth: 5,
          shellCoverageCertificationMaximumSubdivisionDepth: 7,
          shellCoverageRepairMinimumDirectionDiameter: 0.04,
          shellCoverageRepairPasses: 3,
          shellCoverageRepairNormalUncertaintyScale: 1.2,
          lod: [
            { coreScale: 1, bridges: true },
            { coreScale: 1.1, bridges: true },
            { coreScale: 1.2, bridges: false },
          ],
        },
      },
    },
    'columnar',
  );

  assert.equal(policy.profile, 'columnar');
  assert.equal(policy.verticalBias, 0.5);
  assert.equal(policy.bridgeRadiusRatio, 0.36);
  assert.equal(policy.maximumShellCardWidthSpread, 1.8);
  assert.equal(policy.shellCoverageRepairBudgetRatio, 0.09);
  assert.equal(policy.shellCoverageEmergencyBudgetRatio, 0.21);
  assert.equal(policy.shellCoverageRepairStopRatio, 0.46);
  assert.equal(policy.shellCoverageRepairMaximumSubdivisionDepth, 5);
  assert.equal(policy.shellCoverageCertificationMaximumSubdivisionDepth, 7);
  assert.equal(policy.shellCoverageRepairMinimumDirectionDiameter, 0.04);
  assert.equal(policy.shellCoverageRepairPasses, 3);
  assert.equal(policy.shellCoverageRepairNormalUncertaintyScale, 1.2);
  assert.equal(policy.lod[2].bridges, false);
});

test('legacy probe ratio remains accepted as the adaptive repair budget', () => {
  const policy = resolveFoliageContinuityProfile(
    { shellCoverageRepairProbeRatio: 0.07 },
    'round',
  );

  assert.equal(policy.shellCoverageRepairBudgetRatio, 0.07);
});

test('round continuity defaults to adaptive shell coverage settings', () => {
  const policy = resolveFoliageContinuityProfile(null, 'round');

  assert.equal(policy.maximumShellCardWidthSpread, 1.4);
  assert.equal(policy.shellCoverageRepairBudgetRatio, 0.10);
  assert.equal(policy.shellCoverageEmergencyBudgetRatio, 0.24);
  assert.equal(policy.shellCoverageRepairStopRatio, 0.5);
  assert.equal(policy.shellCoverageRepairMaximumSubdivisionDepth, 4);
  assert.equal(policy.shellCoverageCertificationMaximumSubdivisionDepth, 6);
  assert.equal(policy.shellCoverageRepairMinimumDirectionDiameter, 0.055);
  assert.equal(policy.shellCoverageRepairPasses, 2);
  assert.equal(policy.shellCoverageRepairNormalUncertaintyScale, 1);
});

test('continuity configuration rejects invalid core scale', () => {
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        {
          lod: [
            { coreScale: 1, bridges: true },
            { coreScale: 2, bridges: true },
            { coreScale: 1, bridges: true },
          ],
        },
        'round',
      ),
    /coreScale/,
  );
});

test('continuity configuration rejects card width spread below one', () => {
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { maximumShellCardWidthSpread: 0.9 },
        'round',
      ),
    /maximumShellCardWidthSpread/,
  );
});

test('continuity configuration rejects invalid adaptive coverage tuning', () => {
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { shellCoverageRepairBudgetRatio: 1.1 },
        'round',
      ),
    /shellCoverageRepairBudgetRatio/,
  );
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        {
          shellCoverageRepairBudgetRatio: 0.3,
          shellCoverageEmergencyBudgetRatio: 0.2,
        },
        'round',
      ),
    /shellCoverageEmergencyBudgetRatio.*>=/,
  );
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { shellCoverageRepairStopRatio: 0.05 },
        'round',
      ),
    /shellCoverageRepairStopRatio/,
  );
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { shellCoverageRepairMaximumSubdivisionDepth: 2.5 },
        'round',
      ),
    /MaximumSubdivisionDepth.*integer/,
  );
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        {
          shellCoverageRepairMaximumSubdivisionDepth: 6,
          shellCoverageCertificationMaximumSubdivisionDepth: 5,
        },
        'round',
      ),
    /shellCoverageCertificationMaximumSubdivisionDepth.*>=/,
  );
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { shellCoverageRepairPasses: 0 },
        'round',
      ),
    /shellCoverageRepairPasses/,
  );
});

test('continuity configuration rejects numeric strings instead of coercing them', () => {
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { verticalBias: '0.25' },
        'round',
      ),
    /verticalBias.*finite number/,
  );
});

test('continuity configuration rejects malformed profile overrides', () => {
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        { profiles: { round: [] } },
        'round',
      ),
    /profiles\.round.*object/,
  );
});

test('continuity configuration rejects malformed LOD entries', () => {
  assert.throws(
    () =>
      resolveFoliageContinuityProfile(
        {
          lod: [
            { coreScale: 1, bridges: true },
            1,
            { coreScale: 1, bridges: true },
          ],
        },
        'round',
      ),
    /lod\[1\].*object/,
  );
});
