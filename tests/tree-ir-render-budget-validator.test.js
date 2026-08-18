import assert from 'node:assert/strict';
import test from 'node:test';
import { validateTreeIrRenderBudgets } from '../src/rendering/tree-ir-render-budget-validator.js';

function qualityProfile() {
  return {
    representations: {
      hero: { foliageDensity: 1 },
      near: { foliageDensity: 0.58 },
    },
  };
}

function renderingConfig() {
  return {
    foliage: {
      heroCardPlanes: 3,
      nearCardPlanes: 2,
      frondHeroLeaflets: true,
      frondNearLeaflets: true,
      frondAggregateLeaflets: true,
      frondNearSegmentRatio: 0.58,
      frondAggregateDensity: 0.72,
      frondAggregateSegmentRatio: 0.35,
    },
  };
}

test('current native foliage policy is monotonically cheaper across LODs', () => {
  const costs = validateTreeIrRenderBudgets(qualityProfile(), renderingConfig());

  assert.equal(costs.heroCardCost, 3);
  assert.ok(Math.abs(costs.nearCardCost - 1.16) < 1e-12);
  assert.equal(costs.heroFrondCost, 2);
  assert.ok(Math.abs(costs.nearFrondCost - 0.6728) < 1e-12);
  assert.ok(Math.abs(costs.aggregateFrondCost - 0.504) < 1e-12);
  assert.ok(costs.aggregateFrondCost < costs.nearFrondCost);
  assert.ok(costs.nearFrondCost < costs.heroFrondCost);
});

test('aggregate frond proxy cannot become more expensive than near fronds', () => {
  const config = renderingConfig();
  config.foliage.frondAggregateDensity = 1;
  config.foliage.frondAggregateSegmentRatio = 0.8;

  assert.throws(
    () => validateTreeIrRenderBudgets(qualityProfile(), config),
    /Aggregate frond budget/,
  );
});

test('near foliage cards cannot exceed hero card cost', () => {
  const profile = qualityProfile();
  const config = renderingConfig();
  profile.representations.near.foliageDensity = 1;
  config.foliage.nearCardPlanes = 4;

  assert.throws(
    () => validateTreeIrRenderBudgets(profile, config),
    /Near foliage-card budget/,
  );
});
