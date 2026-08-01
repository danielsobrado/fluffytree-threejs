import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createStressSceneConfig,
  isStressSceneRequested,
  STRESS_TREE_COUNT,
} from '../src/app/stress-scene.js';

test('stress scene creates a deterministic 75-tree 720p-oriented layout', () => {
  const source = {
    scene: { fogNear: 20, fogFar: 60, groundSize: 70 },
    camera: { far: 120, position: [1, 2, 3], target: [0, 4, 0] },
    renderer: { maxPixelRatio: 2, shadowMapSize: 2048 },
    layout: [
      { preset: 'a', seed: 10 },
      { preset: 'b', seed: 20 },
      { preset: 'c', seed: 30 },
    ],
  };
  const first = createStressSceneConfig(source);
  const second = createStressSceneConfig(source);
  assert.deepEqual(first, second);
  assert.equal(first.layout.length, STRESS_TREE_COUNT);
  assert.deepEqual(first.layout.slice(0, 3).map((entry) => entry.preset), [
    'a',
    'b',
    'c',
  ]);
  assert.equal(first.renderer.maxPixelRatio, 1);
  assert.equal(source.layout.length, 3);
  assert.equal(isStressSceneRequested('?qa=stress'), true);
});
