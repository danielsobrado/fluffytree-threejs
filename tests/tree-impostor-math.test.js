import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateImpostorLayout,
  projectImpostorLobe,
} from '../src/rendering/tree-impostor-math.js';

function createTreeData() {
  return {
    height: 6,
    trunk: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 3, z: 0 },
        { x: 0, y: 6, z: 0 },
      ],
      startRadius: 0.3,
      endRadius: 0.1,
    },
    branches: [],
    lobes: [
      {
        position: { x: 1.5, y: 4, z: 0.5 },
        scale: { x: 2, y: 1, z: 0.5 },
        rotation: { x: 0, y: 0, z: 0 },
      },
    ],
  };
}

test('impostor layout keeps a square world plane without squaring tree aspect', () => {
  const layout = calculateImpostorLayout(createTreeData());
  assert.ok(layout.worldSize >= layout.width);
  assert.ok(layout.worldSize >= layout.height);
  assert.ok(layout.width !== layout.height);
});

test('tree rotation changes the projected lobe silhouette and anchor', () => {
  const tree = createTreeData();
  const front = projectImpostorLobe(tree.lobes[0], 0);
  const side = projectImpostorLobe(tree.lobes[0], Math.PI * 0.5);
  assert.ok(front.extentX > side.extentX);

  const frontLayout = calculateImpostorLayout(tree, 0);
  const sideLayout = calculateImpostorLayout(tree, Math.PI * 0.5);
  assert.notDeepEqual(frontLayout.anchor, sideLayout.anchor);
});
