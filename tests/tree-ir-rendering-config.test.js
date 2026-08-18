import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTreeIrRenderingConfig } from '../src/rendering/tree-ir-rendering-config.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const config = readYamlConfigSync(
  new URL('../config/tree-ir-rendering.yaml', import.meta.url),
);

test('direct Tree IR rendering policy parses into immutable role settings', () => {
  const parsed = parseTreeIrRenderingConfig(config);

  assert.equal(parsed.structure.hero.radialSegments, 10);
  assert.equal(parsed.structure.aggregate.branchCurveSamples, 4);
  assert.equal(parsed.crown.heroScale, 0.64);
  assert.equal(parsed.crown.heroBrightness, 0.7);
  assert.equal(parsed.crown.shapeVariation, 0.08);
  assert.equal(parsed.crown.surfaceVariation, 0.07);
  assert.equal(parsed.crown.depthShading, 0.14);
  assert.equal(parsed.foliage.alphaResolution, 96);
  assert.equal(parsed.foliage.nearAlphaTest, 0.3);
  assert.equal(parsed.foliage.heroCardPlanes, 3);
  assert.equal(parsed.foliage.nearCardPlanes, 2);
  assert.equal(parsed.foliage.heroCardDepthSpread, 0.08);
  assert.equal(parsed.foliage.nearCardDepthSpread, 0.05);
  assert.equal(parsed.foliage.cardLean, 0.12);
  assert.equal(parsed.foliage.surfaceMottle, 0.06);
  assert.equal(parsed.foliage.surfaceEdgeDarkening, 0.08);
  assert.equal(parsed.foliage.surfaceVerticalTint, 0.05);
  assert.equal(parsed.foliage.frondHeroLeaflets, true);
  assert.equal(parsed.foliage.frondNearLeaflets, true);
  assert.equal(parsed.foliage.frondAggregateLeaflets, true);
  assert.equal(parsed.foliage.frondLeafletLengthRatio, 0.95);
  assert.equal(parsed.foliage.frondNearSegmentRatio, 0.58);
  assert.equal(parsed.foliage.frondAggregateDensity, 0.72);
  assert.equal(parsed.foliage.frondAggregateSegmentRatio, 0.35);
  assert.equal(Object.isFrozen(parsed.structure.hero), true);
  assert.equal(Object.isFrozen(parsed.foliage), true);
});

test('direct Tree IR rendering policy rejects invalid quality values', () => {
  const invalidAlpha = structuredClone(config);
  invalidAlpha.directIr.foliage.alphaResolution = 8;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidAlpha),
    /alphaResolution/,
  );

  const invalidSurfaceMottle = structuredClone(config);
  invalidSurfaceMottle.directIr.foliage.surfaceMottle = 0.4;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidSurfaceMottle),
    /surfaceMottle/,
  );

  const invalidAggregateDensity = structuredClone(config);
  invalidAggregateDensity.directIr.foliage.frondAggregateDensity = 0.1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidAggregateDensity),
    /frondAggregateDensity/,
  );

  const invalidAggregateSegments = structuredClone(config);
  invalidAggregateSegments.directIr.foliage.frondAggregateSegmentRatio = 1.1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidAggregateSegments),
    /frondAggregateSegmentRatio/,
  );

  const invalidLeafletFlag = structuredClone(config);
  invalidLeafletFlag.directIr.foliage.frondAggregateLeaflets = 1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidLeafletFlag),
    /frondAggregateLeaflets.*boolean/,
  );
});

test('lower native LODs cannot exceed higher-detail geometry settings', () => {
  const invalidNear = structuredClone(config);
  invalidNear.directIr.structure.near.radialSegments =
    invalidNear.directIr.structure.hero.radialSegments + 1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidNear),
    /structure\.near\.radialSegments/,
  );

  const invalidAggregate = structuredClone(config);
  invalidAggregate.directIr.structure.aggregate.branchCurveSamples =
    invalidAggregate.directIr.structure.near.branchCurveSamples + 1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidAggregate),
    /structure\.aggregate\.branchCurveSamples/,
  );

  const invalidShadow = structuredClone(config);
  invalidShadow.directIr.shadow.trunkCurveSamples =
    invalidShadow.directIr.structure.near.trunkCurveSamples + 1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidShadow),
    /shadow\.trunkCurveSamples/,
  );
});

test('lower native foliage and crown LODs preserve their visual hierarchy', () => {
  const invalidCards = structuredClone(config);
  invalidCards.directIr.foliage.nearCardPlanes = 3;
  invalidCards.directIr.foliage.heroCardPlanes = 2;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCards),
    /nearCardPlanes must not exceed heroCardPlanes/,
  );

  const invalidCardDepth = structuredClone(config);
  invalidCardDepth.directIr.foliage.nearCardDepthSpread = 0.12;
  invalidCardDepth.directIr.foliage.heroCardDepthSpread = 0.08;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCardDepth),
    /nearCardDepthSpread must not exceed heroCardDepthSpread/,
  );

  const invalidNearAlpha = structuredClone(config);
  invalidNearAlpha.directIr.foliage.nearAlphaTest = 0.5;
  invalidNearAlpha.directIr.foliage.alphaTest = 0.4;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidNearAlpha),
    /nearAlphaTest must not exceed alphaTest/,
  );

  const invalidNearLeaflets = structuredClone(config);
  invalidNearLeaflets.directIr.foliage.frondHeroLeaflets = false;
  invalidNearLeaflets.directIr.foliage.frondNearLeaflets = true;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidNearLeaflets),
    /frondNearLeaflets requires frondHeroLeaflets/,
  );

  const invalidAggregateLeaflets = structuredClone(config);
  invalidAggregateLeaflets.directIr.foliage.frondNearLeaflets = false;
  invalidAggregateLeaflets.directIr.foliage.frondAggregateLeaflets = true;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidAggregateLeaflets),
    /frondAggregateLeaflets requires frondNearLeaflets/,
  );

  const invalidFrondSegments = structuredClone(config);
  invalidFrondSegments.directIr.foliage.frondAggregateSegmentRatio = 0.8;
  invalidFrondSegments.directIr.foliage.frondNearSegmentRatio = 0.6;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidFrondSegments),
    /frondAggregateSegmentRatio must not exceed frondNearSegmentRatio/,
  );

  const invalidCrownDetail = structuredClone(config);
  invalidCrownDetail.directIr.crown.aggregateDetail = 2;
  invalidCrownDetail.directIr.crown.nearDetail = 1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCrownDetail),
    /aggregateDetail must not exceed nearDetail/,
  );

  const invalidCrownScale = structuredClone(config);
  invalidCrownScale.directIr.crown.nearScale = 0.55;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCrownScale),
    /crown scale must not decrease/,
  );

  const invalidCrownBrightness = structuredClone(config);
  invalidCrownBrightness.directIr.crown.aggregateBrightness = 0.65;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCrownBrightness),
    /crown brightness must not decrease/,
  );
});
