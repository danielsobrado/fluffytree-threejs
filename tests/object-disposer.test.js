import assert from 'node:assert/strict';
import test from 'node:test';
import { disposeObject } from '../src/rendering/object-disposer.js';

function resource() {
  return {
    disposed: 0,
    dispose() {
      this.disposed += 1;
    },
  };
}

function rootWith(...objects) {
  return {
    userData: {},
    traverse(visitor) {
      visitor(this);
      objects.forEach(visitor);
    },
  };
}

test('object disposer releases object, geometry, material, and shared resources once', () => {
  const shared = resource();
  const geometry = resource();
  const material = resource();
  material.userData = { disposables: [shared] };
  const rootOwned = resource();
  const root = rootWith({ geometry, material, userData: {} });
  root.userData.disposables = [rootOwned, shared];

  disposeObject(root);

  assert.equal(rootOwned.disposed, 1);
  assert.equal(shared.disposed, 1);
  assert.equal(geometry.disposed, 1);
  assert.equal(material.disposed, 1);
});

test('object disposer preserves explicitly shared resources during partial rollback', () => {
  const shared = resource();
  const geometry = resource();
  const material = resource();
  material.userData = { disposables: [shared] };
  const root = rootWith({ geometry, material, userData: {} });

  disposeObject(root, { preserveResources: [shared] });

  assert.equal(shared.disposed, 0);
  assert.equal(geometry.disposed, 1);
  assert.equal(material.disposed, 1);
});
