import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseFoliageRepresentationPolicy,
  resolveFoliageRepresentationProfile,
} from '../src/rendering/foliage-representation-policy.js';

function config() {
  return {
    profiles: {
      default: {
        hero: {
          shellDensity: 1,
          shellInteriorDensity: 0.09,
          leafDensityMultiplier: 1,
        },
        near: {
          shellDensity: 0.75,
          leafDensityMultiplier: 0,
        },
        geometry: {
          shape: 'diamond',
          lengthMultiplier: 1,
          widthMultiplier: 1,
          shoulderRatio: 0.44,
          midRatio: 0.72,
          shoulderWidthRatio: 0.72,
        },
        orientation: { tiltRadians: 0 },
      },
      puff: {
        hero: {
          shellDensity: 0.34,
          shellInteriorDensity: 0.02,
          leafDensityMultiplier: 5,
          leafLayerCount: 2,
        },
        near: {
          shellDensity: 0.58,
          leafDensityMultiplier: 0,
        },
        geometry: {
          shape: 'oval',
          lengthMultiplier: 1.02,
          widthMultiplier: 1.18,
          shoulderRatio: 0.3,
          midRatio: 0.64,
          shoulderWidthRatio: 0.72,
        },
        orientation: { tiltRadians: 0.24 },
      },
    },
  };
}

test('foliage representation policy resolves shape-specific profile', () => {
  const policy = parseFoliageRepresentationPolicy(config());
  const puff = resolveFoliageRepresentationProfile(policy, 'puff');
  const fallback = resolveFoliageRepresentationProfile(policy, 'broadleaf');

  assert.equal(puff.geometry.shape, 'oval');
  assert.equal(puff.hero.leafLayerCount, 2);
  assert.equal(fallback.geometry.shape, 'diamond');
  assert.equal(fallback.hero.leafLayerCount, undefined);
  assert.equal(fallback.near.leafDensityMultiplier, 0);
});

test('foliage representation policy rejects invalid geometry ordering', () => {
  const invalid = config();
  invalid.profiles.puff.geometry.midRatio = 0.2;

  assert.throws(
    () => parseFoliageRepresentationPolicy(invalid),
    /midRatio/,
  );
});

test('foliage representation policy rejects misspelled leaf profiles', () => {
  const invalid = config();
  invalid.profiles.puf = invalid.profiles.puff;
  delete invalid.profiles.puff;

  assert.throws(
    () => parseFoliageRepresentationPolicy(invalid),
    /known leaf shape/,
  );
});

test('foliage representation policy validates optional layer overrides', () => {
  const invalid = config();
  invalid.profiles.default.hero.leafLayerCount = 0;

  assert.throws(
    () => parseFoliageRepresentationPolicy(invalid),
    /leafLayerCount/,
  );
});
