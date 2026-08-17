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
  let windRegistered = false;
  let windUnregisterCount = 0;
  const windController = {
    register() {
      windRegistered = true;
      return true;
    },
    unregister() {
      windRegistered = false;
      windUnregisterCount += 1;
      return true;
    },
    update() {},
    clear() {},
  };
  const showcase = new UniversalTreeShowcase({
    sceneFactory: { create() {} },
    treeGenerator: { generateIr: () => ({ seed: 1 }) },
    treeMeshBuilder: { build: () => root },
    windController,
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
    register: () =>
      billboardRegister({ sceneObjects, lodRegistered, windRegistered }),
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
    get windRegistered() {
      return windRegistered;
    },
    get windUnregisterCount() {
      return windUnregisterCount;
    },
  };
}

const ENTRY = Object.freeze({ seed: 1, position: [0, 0, 0], rotationY: 0 });
const PRESET = Object.freeze({ id: 'testTree' });

test('billboard registration runs after scene, LOD and wind registration', () => {
  const root = createRoot();
  const fixture = createShowcase(
    root,
    ({ sceneObjects, lodRegistered, windRegistered }) => {
      assert.equal(sceneObjects.has(root), true);
      assert.equal(lodRegistered, true);
      assert.equal(windRegistered, true);
      return { batch: {}, index: 0 };
    },
  );

  fixture.showcase.addTree(ENTRY, PRESET);

  assert.equal(fixture.sceneObjects.has(root), true);
  assert.equal(fixture.lodRegistered, true);
  assert.equal(fixture.windRegistered, true);
  assert.deepEqual(fixture.showcase.treeRoots, [root]);
});

test('missing far impostor rolls back wind, LOD and scene registration', () => {
  const root = createRoot();
  const fixture = createShowcase(root, () => null);

  assert.throws(
    () => fixture.showcase.addTree(ENTRY, PRESET),
    /could not register its far impostor/,
  );
  assert.equal(fixture.sceneObjects.has(root), false);
  assert.equal(fixture.lodRegistered, false);
  assert.equal(fixture.windRegistered, false);
  assert.equal(fixture.windUnregisterCount, 1);
  assert.equal(fixture.unregisterCount, 1);
  assert.deepEqual(fixture.showcase.treeRoots, []);
});
