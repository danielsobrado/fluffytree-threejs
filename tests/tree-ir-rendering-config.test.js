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
  assert.equal(parsed.foliage.heroCardPlanes, 2);
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

test('lower native foliage and crown LODs remain cheaper than higher LODs', () => {
  const invalidCards = structuredClone(config);
  invalidCards.directIr.foliage.nearCardPlanes = 3;
  invalidCards.directIr.foliage.heroCardPlanes = 2;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCards),
    /nearCardPlanes must not exceed heroCardPlanes/,
  );

  const invalidFrondSegments = structuredClone(config);
  invalidFrondSegments.directIr.foliage.frondAggregateSegmentRatio = 0.8;
  invalidFrondSegments.directIr.foliage.frondNearSegmentRatio = 0.6;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidFrondSegments),
    /frondAggregateSegmentRatio must not exceed frondNearSegmentRatio/,
  );

  const invalidCrown = structuredClone(config);
  invalidCrown.directIr.crown.aggregateDetail = 2;
  invalidCrown.directIr.crown.nearDetail = 1;
  assert.throws(
    () => parseTreeIrRenderingConfig(invalidCrown),
    /aggregateDetail must not exceed nearDetail/,
  );
});
