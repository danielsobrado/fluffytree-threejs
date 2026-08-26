import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  freezeStaticLocalTransform,
  freezeStaticSubtree,
} from '../src/rendering/static-object-transform.js';

test('static transforms freeze local updates while preserving world propagation', () => {
  const scene = new THREE.Scene();
  scene.position.set(7, -2, 3);

  const object = new THREE.Object3D();
  object.position.set(4, 5, 6);
  object.matrixWorldAutoUpdate = false;
  scene.add(object);

  freezeStaticLocalTransform(object);
  scene.updateMatrixWorld(true);

  assert.equal(object.matrixAutoUpdate, false);
  assert.equal(object.matrixWorldAutoUpdate, true);
  assert.deepEqual(object.matrix.elements.slice(12, 15), [4, 5, 6]);
  assert.deepEqual(object.matrixWorld.elements.slice(12, 15), [11, 3, 9]);
});

test('static subtree freezes local and world updates after resolving transforms', () => {
  const root = new THREE.Group();
  root.position.set(4, 0, 2);
  const child = new THREE.Object3D();
  child.position.set(3, 5, 7);
  root.add(child);

  freezeStaticSubtree(root);

  assert.equal(root.matrixAutoUpdate, false);
  assert.equal(root.matrixWorldAutoUpdate, false);
  assert.equal(child.matrixAutoUpdate, false);
  assert.equal(child.matrixWorldAutoUpdate, false);
  assert.deepEqual(child.matrixWorld.elements.slice(12, 15), [7, 5, 9]);
});

test('static transforms reject incompatible objects', () => {
  assert.throws(
    () => freezeStaticLocalTransform({}),
    /Object3D-compatible object/,
  );
  assert.throws(
    () => freezeStaticSubtree({ updateMatrix() {} }),
    /traversable Object3D-compatible object/,
  );
});
