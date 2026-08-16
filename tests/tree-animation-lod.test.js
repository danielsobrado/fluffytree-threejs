import assert from 'node:assert/strict';
import test from 'node:test';
import { ForestAnimationBudgetAllocator } from '../src/animation/forest-animation-budget-allocator.js';
import { TreeAnimationLodPlanner } from '../src/animation/tree-animation-lod-planner.js';
import { parseTreeAnimationPolicy } from '../src/animation/tree-animation-policy-config.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const policy = parseTreeAnimationPolicy(
  readYamlConfigSync(new URL('../config/tree-animation-policy.yaml', import.meta.url)),
);

test('animation LOD collapses the Tree IR wind hierarchy independently of geometry', () => {
  const ir = new TreeGenerator().generateIr(createTestPreset(), 91, {
    includeSurfaceSamples: false,
  });
  const planner = new TreeAnimationLodPlanner();
  const hero = planner.compile(ir, 'hero', policy);
  const near = planner.compile(ir, 'near', policy);
  const aggregate = planner.compile(ir, 'aggregate', policy);
  const impostor = planner.compile(ir, 'impostor', policy);

  assert.equal(hero.activeWindNodeCount, ir.windNodes.length);
  assert.ok(near.activeWindNodeCount <= hero.activeWindNodeCount);
  assert.ok(aggregate.activeWindNodeCount <= near.activeWindNodeCount);
  assert.ok(impostor.activeWindNodeCount <= aggregate.activeWindNodeCount);
  assert.equal(hero.animationMode, 'hierarchical');
  assert.equal(impostor.animationMode, 'cheap-sway');
});

test('animation budget preserves geometry role while downgrading motion detail', () => {
  const constrained = Object.freeze({
    ...policy,
    maximumHierarchicalTrees: 1,
    maximumReducedTrees: 1,
  });
  const entries = [
    { instance: { id: 'a' }, role: 'hero', projectedPixels: 500 },
    { instance: { id: 'b' }, role: 'hero', projectedPixels: 400 },
    { instance: { id: 'c' }, role: 'hero', projectedPixels: 300 },
    { instance: { id: 'd' }, role: 'near', projectedPixels: 200 },
  ];

  const result = new ForestAnimationBudgetAllocator().allocate(entries, constrained);

  assert.equal(result.allocations[0].geometryRole, 'hero');
  assert.equal(result.allocations[0].animationRole, 'hero');
  assert.equal(result.allocations[1].geometryRole, 'hero');
  assert.equal(result.allocations[1].animationRole, 'near');
  assert.equal(result.allocations[2].animationRole, 'aggregate');
  assert.equal(result.allocations[3].animationRole, 'aggregate');
  assert.equal(result.metrics.hierarchicalCount, 1);
  assert.equal(result.metrics.reducedCount, 1);
  assert.equal(result.metrics.downgradedCount, 3);
});
