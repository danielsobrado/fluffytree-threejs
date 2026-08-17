import assert from 'node:assert/strict';
import test from 'node:test';
import { UniversalTreeShowcase } from '../src/app/universal-tree-showcase.js';

function createRoot() {
  return {
    position: { fromArray() {} },
    rotation: { y: 0 },
    userData: { lod: {} },
    updateMatrixWorld() {},
    traverse(visitor) {
      visitor(this);
    },
  };
}

function createShowcase(root, billboardRegister) {
  const showcase = new UniversalTreeShowcase({
    sceneFactory: { create() {} },
    treeGenerator: { generateIr: () => ({}) },
    treeMeshBuilder: { build: () => root },
    renderSmokeProbe: { enabled: false },
  });
  const sceneObjects = new Set();
  const scene = {
    add(object) {
      sceneObjects.add(object);
    },
    remove(object) {
      sceneObjects.delete(object);
    },
  };
  let lodRegistered = false;
  let unregisterCount = 0;
  showcase.context = {
    scene,
    sun: {
      position: {
        clone() {
          return { normalize: () => ({}) };
        },
      },
    },
  };
  showcase.impostorRenderer = {};
  showcase.lodController = {
    register() {
      lodRegistered = true;
      return true;
    },
    unregister() {
      lodRegistered = false;
      unregisterCount += 1;
      return true;
    },
  };
  showcase.billboardBatchManager = {
    register: () => billboardRegister({ sceneObjects, lodRegistered }),
  };
  return {
    showcase,
    sceneObjects,
    get lodRegistered() {
      return lodRegistered;
    },
    get unregisterCount() {
      return unregisterCount;
    },
  };
}

const ENTRY = Object.freeze({ seed: 1, position: [0, 0, 0], rotationY: 0 });
const PRESET = Object.freeze({ id: 'testTree' });

test('billboard registration runs only after scene and LOD registration commit', () => {
  const root = createRoot();
  const fixture = createShowcase(root, ({ sceneObjects, lodRegistered }) => {
    assert.equal(sceneObjects.has(root), true);
    assert.equal(lodRegistered, true);
    return { batch: {}, index: 0 };
  });

  fixture.showcase.addTree(ENTRY, PRESET);

  assert.equal(fixture.sceneObjects.has(root), true);
  assert.equal(fixture.lodRegistered, true);
  assert.deepEqual(fixture.showcase.treeRoots, [root]);
});

test('missing far impostor rolls back scene tracking and LOD registration', () => {
  const root = createRoot();
  const fixture = createShowcase(root, () => null);

  assert.throws(
    () => fixture.showcase.addTree(ENTRY, PRESET),
    /could not register its far impostor/,
  );
  assert.equal(fixture.sceneObjects.has(root), false);
  assert.equal(fixture.lodRegistered, false);
  assert.equal(fixture.unregisterCount, 1);
  assert.deepEqual(fixture.showcase.treeRoots, []);
});
