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
  assert.equal(policy.lod[2].bridges, false);
});

test('round continuity defaults to the certified card width spread', () => {
  const policy = resolveFoliageContinuityProfile(null, 'round');

  assert.equal(policy.maximumShellCardWidthSpread, 1.4);
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
