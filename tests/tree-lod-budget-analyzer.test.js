import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import {
  analyzeTreeLodBudgets,
  evaluateTreeLodBudgets,
} from '../src/qa/tree-lod-budget-analyzer.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('tree LOD representations remain within descending budgets', () => {
  const tree = new TreeGenerator().generate(createTestPreset(), 104729);
  const metrics = analyzeTreeLodBudgets(tree);
  assert.deepEqual(
    evaluateTreeLodBudgets(metrics, {
      maximumTriangles: [25000, 8000, 2000, 2],
      maximumDrawCalls: [5, 4, 2, 1],
      maximumShadowTriangles: 2000,
    }),
    [],
  );
  assert.ok(metrics.lodTriangles[0] > metrics.lodTriangles[1]);
  assert.ok(metrics.lodTriangles[1] > metrics.lodTriangles[2]);
  assert.equal(metrics.lodTriangles[3], 2);
});
