import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeWindController } from '../src/animation/tree-wind-controller.js';

function createTree() {
  const materials = [];
  const tree = {
    userData: { lod: {} },
    traverse(visitor) {
      for (const material of materials) visitor({ material });
    },
  };
  tree.userData.lod.buildHero = () => {
    materials.push({ userData: { windState: { time: 0, phase: 0, strength: 0 } } });
  };
  return tree;
}

test('wind controller discovers materials created by deferred hero LOD', () => {
  const controller = new TreeWindController({ strength: 0.2, speed: 2 });
  const tree = createTree();
  controller.register(tree, 37);
  assert.equal(controller.states.length, 0);

  tree.userData.lod.buildHero();
  assert.equal(controller.states.length, 1);
  assert.equal(controller.states[0].strength, 0.2);

  controller.update(3);
  assert.equal(controller.states[0].time, 6);
});
