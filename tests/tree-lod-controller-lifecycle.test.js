import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { TreeLodController } from '../src/rendering/tree-lod-controller.js';
import {
  TREE_RENDER_REPRESENTATION_ROLES,
  TREE_REPRESENTATION_ROLES,
} from '../src/rendering/tree-representation-role.js';

const SETTINGS = Object.freeze({
  nearPixels: 300,
  mediumPixels: 110,
  farPixels: 35,
  cullPixels: 12,
  hysteresis: 0.12,
  fadeBand: 0.15,
  shadowPixels: 25,
});

function createTree({ heroReady = false } = {}) {
  const tree = new THREE.Group();
  const levels = TREE_RENDER_REPRESENTATION_ROLES.map((role, index) => {
    const level = new THREE.Group();
    level.userData.lod = { role, index };
    return level;
  });
  tree.add(...levels);
  tree.userData.tree = { height: 8, presetId: 'test' };
  tree.userData.lod = {
    levels,
    currentLevel: 1,
    minimumLevel: 0,
    heroReady,
    shadowProxy: new THREE.Group(),
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

function countWorldPositionReads(tree, counter) {
  const getWorldPosition = tree.getWorldPosition.bind(tree);
  tree.getWorldPosition = (target) => {
    counter.count += 1;
    return getWorldPosition(target);
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

test('culled trees keep an explicit non-rendering role without indexing past levels', () => {
  const controller = new TreeLodController(SETTINGS);
  const tree = createTree({ heroReady: true });
  controller.register(tree);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 5000);
  camera.position.set(0, 0, 1000);
  camera.updateMatrixWorld(true);

  assert.doesNotThrow(() => controller.update(camera, 720));
  assert.equal(tree.userData.lod.currentLevel, 4);
  assert.equal(tree.userData.lod.currentRole, TREE_REPRESENTATION_ROLES.CULLED);
  assert.equal(tree.userData.lod.shadowProxy.visible, false);
  assert.deepEqual(controller.summarize(), {
    levels: [0, 0, 0, 0],
    culled: 1,
    total: 1,
  });
});

test('staggered LOD updates cache static tree transforms across camera changes', () => {
  const settings = { ...SETTINGS, updateStride: 2 };
  const controller = new TreeLodController(settings);
  const reads = { count: 0 };
  const first = createTree({ heroReady: true });
  const second = createTree({ heroReady: true });
  countWorldPositionReads(first, reads);
  countWorldPositionReads(second, reads);
  controller.register(first);
  controller.register(second);
  assert.equal(reads.count, 2);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.updateMatrixWorld(true);

  controller.update(camera, 720);
  controller.update(camera, 720);
  assert.equal(reads.count, 2);

  controller.update(camera, 720);
  controller.update(camera, 720);
  assert.equal(reads.count, 2);

  camera.position.x = 1;
  camera.updateMatrixWorld(true);
  controller.update(camera, 720);
  controller.update(camera, 720);
  assert.equal(reads.count, 2);
});

test('LOD update stride rejects values that could disable the sweep', () => {
  for (const updateStride of [0, -1, 1.5, Number.NaN, '2']) {
    assert.throws(
      () => new TreeLodController({ ...SETTINGS, updateStride }),
      /updateStride.*positive integer/,
      String(updateStride),
    );
  }
});
