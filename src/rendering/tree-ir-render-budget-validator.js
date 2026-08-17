import { TREE_REPRESENTATION_ROLES } from './tree-representation-role.js';

const COST_EPSILON = 1e-12;

function requireRepresentation(profile, role) {
  const representation = profile?.representations?.[role];
  if (!representation) {
    throw new Error(`Tree quality profile is missing representation '${role}'.`);
  }
  return representation;
}

function assertNotMoreExpensive(lowerCost, higherCost, label) {
  if (lowerCost > higherCost + COST_EPSILON) {
    throw new RangeError(
      `${label} must not exceed its higher-detail representation cost (${lowerCost} > ${higherCost}).`,
    );
  }
}

export function validateTreeIrRenderBudgets(qualityProfile, renderingConfig) {
  const hero = requireRepresentation(
    qualityProfile,
    TREE_REPRESENTATION_ROLES.HERO,
  );
  const near = requireRepresentation(
    qualityProfile,
    TREE_REPRESENTATION_ROLES.NEAR,
  );
  const foliage = renderingConfig?.foliage;
  if (!foliage) {
    throw new TypeError('Direct Tree IR rendering config requires foliage settings.');
  }

  const heroCardCost = hero.foliageDensity * foliage.heroCardPlanes;
  const nearCardCost = near.foliageDensity * foliage.nearCardPlanes;
  const heroFrondCost = hero.foliageDensity;
  const nearFrondCost = near.foliageDensity * foliage.frondNearSegmentRatio;
  const aggregateFrondCost =
    foliage.frondAggregateDensity * foliage.frondAggregateSegmentRatio;

  assertNotMoreExpensive(nearCardCost, heroCardCost, 'Near foliage-card budget');
  assertNotMoreExpensive(nearFrondCost, heroFrondCost, 'Near frond budget');
  assertNotMoreExpensive(
    aggregateFrondCost,
    nearFrondCost,
    'Aggregate frond budget',
  );

  return Object.freeze({
    heroCardCost,
    nearCardCost,
    heroFrondCost,
    nearFrondCost,
    aggregateFrondCost,
  });
}
