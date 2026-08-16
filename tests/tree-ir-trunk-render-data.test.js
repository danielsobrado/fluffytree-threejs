import assert from 'node:assert/strict';
import test from 'node:test';
import { createTreeIrTrunkRenderData } from '../src/rendering/tree-ir-trunk-render-data.js';

const TREE_IR = Object.freeze({ seed: 918273, height: 12 });
const STEM = Object.freeze({
  path: Object.freeze([
    Object.freeze({ x: 0, y: 0, z: 0 }),
    Object.freeze({ x: 0.4, y: 10, z: 0.2 }),
  ]),
  startRadius: 0.6,
  endRadius: 0.12,
  taperPower: 0.84,
  metadata: Object.freeze({ flare: 0.32, nebari: 0.75 }),
});

test('native trunk render data carries Tree IR seed into root flare geometry', () => {
  const treeData = createTreeIrTrunkRenderData(TREE_IR, STEM);

  assert.equal(treeData.seed, TREE_IR.seed);
  assert.equal(treeData.height, TREE_IR.height);
  assert.equal(treeData.trunk.points.length, 3);
  assert.equal(treeData.trunk.flare, 0.32);
  assert.equal(treeData.trunk.nebari, 0.75);
});
