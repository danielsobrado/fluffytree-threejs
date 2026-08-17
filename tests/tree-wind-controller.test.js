import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeWindController } from '../src/animation/tree-wind-controller.js';
import { calculateTreeWindBoundsPadding } from '../src/animation/tree-wind-profile.js';

const TREE_HEIGHT = 7.5;

function createTree() {
  const materials = [];
  const tree = {
    userData: { tree: { height: TREE_HEIGHT }, lod: {} },
    traverse(visitor) {
      for (const material of materials) visitor({ material, userData: {} });
    },
  };
  tree.userData.lod.buildHero = () => {
    materials.push({
      userData: {
        windState: { time: 0, phase: 0, strength: 0, treeHeight: 1 },
      },
    });
  };
  return tree;
}

function createWindMesh(state) {
  const boundingBox = {
    padding: 0,
    expandByScalar(value) {
      this.padding += value;
    },
  };
  const boundingSphere = { radius: 2 };
  return {
    isInstancedMesh: true,
    material: { userData: { windState: state } },
    userData: {},
    boundingBox,
    boundingSphere,
  };
}

function createTreeWithVisitor(visitor) {
  return {
    userData: { tree: { height: TREE_HEIGHT }, lod: {} },
    traverse: visitor,
  };
}

test('wind controller discovers materials created by deferred hero LOD', () => {
  const controller = new TreeWindController({ strength: 0.2, speed: 2 });
  const tree = createTree();
  controller.register(tree, 37);
  assert.equal(controller.states.length, 0);

  controller.update(3);
  tree.userData.lod.buildHero();
  assert.equal(controller.states.length, 1);
  assert.equal(controller.states[0].strength, 0.2);
  assert.equal(controller.states[0].treeHeight, TREE_HEIGHT);
  assert.equal(controller.states[0].time, 6);

  controller.update(4);
  assert.equal(controller.states[0].time, 8);
});

test('minimum LOD trees do not wrap an unreachable hero builder', () => {
  const controller = new TreeWindController();
  const tree = createTree();
  tree.userData.lod.minimumLevel = 2;
  const buildHero = tree.userData.lod.buildHero;

  controller.register(tree, 37);

  assert.equal(tree.userData.lod.buildHero, buildHero);
});

test('wind controller registers a shared material state only once per tree', () => {
  const sharedState = { time: 0, phase: 0, strength: 0, treeHeight: 1 };
  const tree = createTreeWithVisitor((visitor) => {
    visitor({ material: { userData: { windState: sharedState } }, userData: {} });
    visitor({ material: { userData: { windState: sharedState } }, userData: {} });
  });
  const controller = new TreeWindController();

  controller.register(tree, 11);
  controller.register(tree, 11);

  assert.equal(controller.states.length, 1);
  assert.equal(sharedState.treeHeight, TREE_HEIGHT);
});

test('shared wind states survive until every owning tree unregisters', () => {
  const sharedState = { time: 0, phase: 0, strength: 0, treeHeight: 1 };
  const visitor = (callback) =>
    callback({ material: { userData: { windState: sharedState } }, userData: {} });
  const first = createTreeWithVisitor(visitor);
  const second = createTreeWithVisitor(visitor);
  const controller = new TreeWindController();

  controller.register(first, 1);
  controller.register(second, 2);
  assert.equal(controller.states.length, 1);
  assert.equal(controller.unregister(first), true);
  assert.equal(controller.states.length, 1);
  assert.equal(controller.unregister(second), true);
  assert.equal(controller.states.length, 0);
});

test('unregister restores the original deferred hero builder', () => {
  const controller = new TreeWindController();
  const tree = createTree();
  const originalBuildHero = tree.userData.lod.buildHero;

  controller.register(tree, 1);
  assert.notEqual(tree.userData.lod.buildHero, originalBuildHero);
  assert.equal(controller.unregister(tree), true);
  assert.equal(tree.userData.lod.buildHero, originalBuildHero);
  assert.equal(controller.unregister(tree), false);
});

test('clearing wind state allows fresh trees to register normally', () => {
  const state = { time: 0, phase: 0, strength: 0, treeHeight: 1 };
  const tree = createTreeWithVisitor((visitor) => {
    visitor({ material: { userData: { windState: state } }, userData: {} });
  });
  const controller = new TreeWindController();

  controller.register(tree, 1);
  controller.clear();
  controller.register(tree, 2);

  assert.equal(controller.states.length, 1);
  assert.equal(controller.states[0], state);
});

test('clear restores deferred hero builders before future registration', () => {
  const controller = new TreeWindController();
  const tree = createTree();
  const originalBuildHero = tree.userData.lod.buildHero;

  controller.register(tree, 1);
  const firstWrapper = tree.userData.lod.buildHero;
  controller.clear();
  assert.equal(tree.userData.lod.buildHero, originalBuildHero);

  controller.register(tree, 1);
  assert.notEqual(tree.userData.lod.buildHero, firstWrapper);
  assert.notEqual(tree.userData.lod.buildHero, originalBuildHero);
  tree.userData.lod.buildHero();
  assert.equal(controller.states.length, 1);
});

test('wind controller expands instanced foliage bounds once for GPU sway', () => {
  const state = { time: 0, phase: 0, strength: 0, treeHeight: 1 };
  const mesh = createWindMesh(state);
  const tree = createTreeWithVisitor((visitor) => visitor(mesh));
  const controller = new TreeWindController({ strength: 0.2 });
  const expectedPadding = calculateTreeWindBoundsPadding(0.2);

  controller.register(tree, 1);
  controller.register(tree, 1);

  assert.ok(Math.abs(mesh.boundingBox.padding - expectedPadding) < 1e-12);
  assert.ok(
    Math.abs(mesh.boundingSphere.radius - (2 + expectedPadding)) < 1e-12,
  );
  assert.ok(
    Math.abs(mesh.userData.windBoundsPadding - expectedPadding) < 1e-12,
  );
});

test('wind controller rejects invalid runtime settings and tree heights', () => {
  assert.throws(() => new TreeWindController({ strength: -0.1 }), /strength/);
  assert.throws(() => new TreeWindController({ speed: Number.NaN }), /speed/);
  assert.throws(() => new TreeWindController().update(-1), /elapsed time/);

  const controller = new TreeWindController();
  const tree = createTree();
  tree.userData.tree.height = 0;
  assert.throws(() => controller.register(tree, 1), /height/);
});
