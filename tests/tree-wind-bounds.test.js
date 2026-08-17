import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { expandTreeWindBounds } from '../src/animation/tree-wind-bounds.js';

test('wind bounds expand regular animated mesh geometry once', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  geometry.computeBoundingSphere();
  const radius = geometry.boundingSphere.radius;

  try {
    assert.equal(expandTreeWindBounds(mesh, 0.09), true);
    assert.ok(geometry.boundingSphere.radius > radius);
    const expanded = geometry.boundingSphere.radius;
    assert.equal(expandTreeWindBounds(mesh, 0.09), false);
    assert.equal(geometry.boundingSphere.radius, expanded);
  } finally {
    mesh.material.dispose();
    geometry.dispose();
  }
});

test('wind bounds preserve instanced world-space bounds path', () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, 1);
  mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(4, 0, 0));
  mesh.computeBoundingSphere();
  const radius = mesh.boundingSphere.radius;

  try {
    assert.equal(expandTreeWindBounds(mesh, 0.09), true);
    assert.ok(mesh.boundingSphere.radius > radius);
  } finally {
    material.dispose();
    geometry.dispose();
  }
});
