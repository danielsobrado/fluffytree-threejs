import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { IsolatedCanopySolidityProbe } from '../src/diagnostics/isolated-canopy-solidity-probe.js';
import {
  configureObjectLodFade,
  setObjectLodFade,
  snapshotObjectLodFade,
} from '../src/rendering/lod-dither-fade.js';

function withWindow(search, callback) {
  const previous = globalThis.window;
  globalThis.window = { location: { search } };
  try {
    return callback();
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
}

function createProbe() {
  return withWindow('?qa=solidity', () =>
    new IsolatedCanopySolidityProbe({
      root: { dataset: {} },
      configLoader: { load: async () => ({}) },
    }),
  );
}

function createFadeLevel(name, fade, invert, visible = true) {
  const level = new THREE.Group();
  level.name = name;
  const mesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  level.add(mesh);
  configureObjectLodFade(level);
  setObjectLodFade(level, fade, invert);
  level.visible = visible;
  return level;
}

test('tree isolation restores LOD, child, proxy and wind state', () => {
  const probe = createProbe();
  const tree = new THREE.Group();
  const hero = createFadeLevel('hero', 0.35, true);
  const medium = createFadeLevel('medium', 0.7, false);
  const far = createFadeLevel('far', 0.2, true);
  const impostor = createFadeLevel('impostor', 0, false, false);
  const foliage = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  foliage.visible = false;
  foliage.material.userData.windState = { time: 7 };
  hero.add(foliage);
  tree.add(hero, medium, far, impostor);
  tree.visible = false;
  const shadowProxy = { visible: true };
  const lodState = {
    levels: [hero, medium, far, impostor],
    shadowProxy,
  };
  const before = lodState.levels.map(snapshotObjectLodFade);

  const restore = probe.isolateTree(tree, lodState);
  for (const level of lodState.levels) setObjectLodFade(level, 1, false);
  foliage.visible = true;
  foliage.material.userData.windState.time = 99;
  restore();

  assert.equal(tree.visible, false);
  assert.equal(shadowProxy.visible, true);
  assert.equal(foliage.visible, false);
  assert.equal(foliage.material.userData.windState.time, 7);
  lodState.levels.forEach((level, index) => {
    const after = snapshotObjectLodFade(level);
    assert.equal(after.visible, before[index].visible);
    assert.deepEqual(
      after.states.map(({ value, invert }) => ({ value, invert })),
      before[index].states.map(({ value, invert }) => ({ value, invert })),
    );
  });
});

test('scene isolation restores the caller render target and scene state', () => {
  const probe = createProbe();
  const previousTarget = { id: 'caller-target' };
  let currentTarget = previousTarget;
  let clearColor = 0x123456;
  let clearAlpha = 0.4;
  const renderer = {
    getRenderTarget: () => currentTarget,
    setRenderTarget: (target) => {
      currentTarget = target;
    },
    getClearColor: (target) => target.set(clearColor),
    getClearAlpha: () => clearAlpha,
    setClearColor: (color, alpha) => {
      clearColor = color instanceof THREE.Color ? color.getHex() : color;
      clearAlpha = alpha;
    },
  };
  const scene = new THREE.Scene();
  const background = new THREE.Color(0xabcdef);
  const fog = new THREE.Fog(0xffffff, 1, 10);
  const visible = new THREE.Group();
  scene.background = background;
  scene.fog = fog;
  scene.add(visible);

  const restore = probe.beginIsolation(renderer, scene);
  currentTarget = { id: 'probe-target' };
  restore();

  assert.equal(currentTarget, previousTarget);
  assert.equal(scene.background, background);
  assert.equal(scene.fog, fog);
  assert.equal(visible.visible, true);
  assert.equal(clearColor, 0x123456);
  assert.equal(clearAlpha, 0.4);
});
