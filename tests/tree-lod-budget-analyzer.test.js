import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import {
  analyzeTreeLodBudgets,
  evaluateTreeLodBudgets,
} from '../src/qa/tree-lod-budget-analyzer.js';
import { parseFoliageRepresentationPolicy } from '../src/rendering/foliage-representation-policy.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

function createPuffPolicy(nearLeafDensityMultiplier = 0) {
  return parseFoliageRepresentationPolicy({
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
          leafDensityMultiplier: nearLeafDensityMultiplier,
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
  });
}

test('tree LOD representations remain within descending budgets', () => {
  const tree = new TreeGenerator().generate(createTestPreset(), 104729);
  const metrics = analyzeTreeLodBudgets(tree, {
    foliageRenderingPolicy: createPuffPolicy(),
  });
  assert.deepEqual(
    evaluateTreeLodBudgets(metrics, {
      maximumTriangles: [25000, 8000, 2000, 2],
      maximumDrawCalls: [5, 4, 2, 1],
      maximumShadowTriangles: 2000,
    }),
    [],
  );
  assert.equal(metrics.heroLeafLayerCount, 4);
  assert.ok(metrics.lodTriangles[0] > metrics.lodTriangles[1]);
  assert.ok(metrics.lodTriangles[1] > metrics.lodTriangles[2]);
  assert.equal(metrics.lodTriangles[3], 2);
});

test('tree LOD analyzer follows the foliage representation policy', () => {
  const tree = new TreeGenerator().generate(
    createTestPreset({
      foliage: {
        leafShape: 'puff',
        heroLeaves: {
          density: 1,
          layerCount: 3,
        },
      },
    }),
    104729,
  );
  const production = analyzeTreeLodBudgets(tree, {
    foliageRenderingPolicy: createPuffPolicy(),
  });
  const nearLeavesEnabled = analyzeTreeLodBudgets(tree, {
    foliageRenderingPolicy: createPuffPolicy(1),
  });

  assert.equal(production.leafTrianglesPerLeaf, 4);
  assert.equal(production.heroLeafLayerCount, 2);
  assert.equal(production.nearLeafClusters, 0);
  assert.ok(production.heroShellClusters <= production.shellClusters);
  assert.ok(production.lodDrawCalls[0] <= 5);
  assert.ok(production.lodDrawCalls[1] <= 4);
  assert.ok(nearLeavesEnabled.nearLeafClusters > 0);
  assert.ok(
    nearLeavesEnabled.lodTriangles[1] > production.lodTriangles[1],
  );
  assert.equal(
    nearLeavesEnabled.lodDrawCalls[1],
    production.lodDrawCalls[1] + 1,
  );
});
