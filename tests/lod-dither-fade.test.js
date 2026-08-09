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
  const root = {
    visible: true,
    traverse(visitor) {
      visitor(this);
      visitor(child);
    },
  };

  configureObjectLodFade(root);
  return { root, material };
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
