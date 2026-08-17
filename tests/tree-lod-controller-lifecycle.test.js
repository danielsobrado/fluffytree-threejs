import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { TreeLodController } from '../src/rendering/tree-lod-controller.js';
import { TREE_RENDER_REPRESENTATION_ROLES } from '../src/rendering/tree-representation-role.js';

const SETTINGS = Object.freeze({
  nearPixels: 300,
  mediumPixels: 110,
  farPixels: 35,
  cullPixels: 12,
  hysteresis: 0.12,
  fadeBand: 0.15,
  shadowPixels: 25,
});

function createTree() {
  const tree = new THREE.Group();
  const levels = TREE_RENDER_REPRESENTATION_ROLES.map((role, index) => {
    const level = new THREE.Group();
    level.userData.lod = { role, index };
    return level;
  });
  tree.add(...levels);
  tree.userData.lod = {
    levels,
    currentLevel: 1,
    minimumLevel: 0,
    heroReady: false,
  };
  return tree;
}

function createQueue(cancelled) {
  return {
    enqueue() {},
    cancel(key) {
      cancelled.push(key);
      return true;
    },
  };
}

test('LOD registration is idempotent and unregister cancels deferred hero work', () => {
  const cancelled = [];
  const controller = new TreeLodController(SETTINGS, createQueue(cancelled));
  const tree = createTree();

  assert.equal(controller.register(tree), true);
  assert.equal(controller.register(tree), false);
  assert.equal(controller.entries.length, 1);
  assert.equal(controller.unregister(tree), true);
  assert.equal(controller.entries.length, 0);
  assert.deepEqual(cancelled, [`${tree.uuid}:hero`]);
  assert.equal(controller.unregister(tree), false);
});

test('LOD clear cancels deferred hero work for every registered tree', () => {
  const cancelled = [];
  const controller = new TreeLodController(SETTINGS, createQueue(cancelled));
  const first = createTree();
  const second = createTree();
  controller.register(first);
  controller.register(second);

  controller.clear();

  assert.equal(controller.entries.length, 0);
  assert.deepEqual(cancelled, [`${first.uuid}:hero`, `${second.uuid}:hero`]);
});
