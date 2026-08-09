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

test('wind controller registers a shared material state only once', () => {
  const sharedState = { time: 0, phase: 0, strength: 0 };
  const tree = {
    userData: { lod: {} },
    traverse(visitor) {
      visitor({ material: { userData: { windState: sharedState } } });
      visitor({ material: { userData: { windState: sharedState } } });
    },
  };
  const controller = new TreeWindController();

  controller.register(tree, 11);
  controller.register(tree, 11);

  assert.equal(controller.states.length, 1);
});

test('clearing wind state allows fresh trees to register normally', () => {
  const state = { time: 0, phase: 0, strength: 0 };
  const tree = {
    userData: { lod: {} },
    traverse(visitor) {
      visitor({ material: { userData: { windState: state } } });
    },
  };
  const controller = new TreeWindController();

  controller.register(tree, 1);
  controller.clear();
  controller.register(tree, 2);

  assert.equal(controller.states.length, 1);
  assert.equal(controller.states[0], state);
});
