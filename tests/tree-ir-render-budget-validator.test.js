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
      heroCardPlanes: 2,
      nearCardPlanes: 1,
      frondHeroLeaflets: true,
      frondNearSegmentRatio: 0.58,
      frondAggregateDensity: 0.72,
      frondAggregateSegmentRatio: 0.35,
    },
  };
}

test('current native foliage policy is monotonically cheaper across LODs', () => {
  const costs = validateTreeIrRenderBudgets(qualityProfile(), renderingConfig());

  assert.equal(costs.heroCardCost, 2);
  assert.equal(costs.nearCardCost, 0.58);
  assert.equal(costs.heroFrondCost, 2);
  assert.ok(costs.aggregateFrondCost < costs.nearFrondCost);
  assert.ok(costs.nearFrondCost < costs.heroFrondCost);
});

test('aggregate frond proxy cannot become more expensive than near fronds', () => {
  const config = renderingConfig();
  config.foliage.frondAggregateDensity = 1;
  config.foliage.frondAggregateSegmentRatio = 0.6;

  assert.throws(
    () => validateTreeIrRenderBudgets(qualityProfile(), config),
    /Aggregate frond budget/,
  );
});

test('near foliage cards cannot exceed hero card cost', () => {
  const profile = qualityProfile();
  const config = renderingConfig();
  profile.representations.near.foliageDensity = 1;
  config.foliage.nearCardPlanes = 3;

  assert.throws(
    () => validateTreeIrRenderBudgets(profile, config),
    /Near foliage-card budget/,
  );
});
