import assert from 'node:assert/strict';
import test from 'node:test';
import {
  configureObjectLodFade,
  restoreObjectLodFade,
  setObjectLodFade,
  snapshotObjectLodFade,
} from '../src/rendering/lod-dither-fade.js';

function createFixture() {
  const material = {
    type: 'TestMaterial',
    userData: {},
    needsUpdate: false,
  };
  const child = { material };
  let traversalCount = 0;
  const root = {
    visible: true,
    children: [child],
    traverse(visitor) {
      traversalCount += 1;
      visitor(this);
      for (const entry of this.children) visitor(entry);
    },
    get traversalCount() {
      return traversalCount;
    },
    resetTraversalCount() {
      traversalCount = 0;
    },
  };

  configureObjectLodFade(root);
  return { root, child, material };
}

test('LOD fade snapshots restore fade, inversion and visibility', () => {
  const { root, material } = createFixture();
  setObjectLodFade(root, 0.35, true);
  const snapshot = snapshotObjectLodFade(root);

  setObjectLodFade(root, 1, false);
  restoreObjectLodFade(root, snapshot);

  assert.equal(root.visible, true);
  assert.equal(material.userData.lodFade.value, 0.35);
  assert.equal(material.userData.lodFade.invert, 1);
});

test('LOD fade snapshots restore hidden levels', () => {
  const { root, material } = createFixture();
  setObjectLodFade(root, 0, false);
  const snapshot = snapshotObjectLodFade(root);

  setObjectLodFade(root, 1, true);
  restoreObjectLodFade(root, snapshot);

  assert.equal(root.visible, false);
  assert.equal(material.userData.lodFade.value, 0);
  assert.equal(material.userData.lodFade.invert, 0);
});

test('LOD fade updates reuse cached material states', () => {
  const { root, material } = createFixture();
  root.resetTraversalCount();

  setObjectLodFade(root, 0.4, true);
  const snapshot = snapshotObjectLodFade(root);

  assert.equal(root.traversalCount, 0);
  assert.equal(material.userData.lodFade.value, 0.4);
  assert.equal(snapshot.states.length, 1);
});

test('LOD fade cache refreshes after direct child replacement', () => {
  const { root, child } = createFixture();
  const replacementMaterial = {
    type: 'TestMaterial',
    userData: {},
    needsUpdate: false,
  };
  const replacement = { material: replacementMaterial };
  configureObjectLodFade({
    visible: true,
    children: [replacement],
    traverse(visitor) {
      visitor(this);
      visitor(replacement);
    },
  });

  root.children[0] = replacement;
  root.resetTraversalCount();
  setObjectLodFade(root, 0.25, false);

  assert.equal(root.traversalCount, 1);
  assert.equal(replacementMaterial.userData.lodFade.value, 0.25);
  assert.equal(child.material.userData.lodFade.value, 1);

  root.resetTraversalCount();
  setObjectLodFade(root, 0.5, true);
  assert.equal(root.traversalCount, 0);
});
