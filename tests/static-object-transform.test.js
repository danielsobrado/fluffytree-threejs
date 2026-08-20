import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { freezeStaticLocalTransform } from '../src/rendering/static-object-transform.js';

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

test('static transforms reject incompatible objects', () => {
  assert.throws(
    () => freezeStaticLocalTransform({}),
    /Object3D-compatible object/,
  );
});
