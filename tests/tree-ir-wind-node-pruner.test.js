import assert from 'node:assert/strict';
import test from 'node:test';
import { pruneUnreferencedTreeIrWindNodes } from '../src/generation/tree-ir-wind-node-pruner.js';

function createTreeIr() {
  return {
    stems: [{ windNodeId: 'wind:root' }],
    foliageSites: [{ windNodeId: 'wind:leaf' }],
    windNodes: [
      { id: 'wind:root', parentId: null },
      { id: 'wind:branch', parentId: 'wind:root' },
      { id: 'wind:leaf', parentId: 'wind:branch' },
      { id: 'wind:orphan', parentId: 'wind:root' },
    ],
  };
}

test('wind pruning retains referenced nodes and their ancestors', () => {
  const treeIr = createTreeIr();

  assert.equal(pruneUnreferencedTreeIrWindNodes(treeIr), 1);
  assert.deepEqual(
    treeIr.windNodes.map((node) => node.id),
    ['wind:root', 'wind:branch', 'wind:leaf'],
  );
});

test('wind pruning removes foliage nodes after their sites are removed', () => {
  const treeIr = createTreeIr();
  treeIr.foliageSites = [];

  assert.equal(pruneUnreferencedTreeIrWindNodes(treeIr), 3);
  assert.deepEqual(treeIr.windNodes.map((node) => node.id), ['wind:root']);
});
