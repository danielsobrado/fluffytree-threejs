import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createForestSceneConfig,
  DEFAULT_FOREST_SIZE,
  FOREST_SIZES,
  isForestSceneRequested,
  resolveForestSize,
} from '../src/app/forest-scene.js';

const PRESETS = Object.freeze([
  { id: 'tallOne', height: 8.25 },
  { id: 'tallTwo', height: 6.9 },
  { id: 'small', height: 3.95 },
  { id: 'bush', height: 1.7 },
]);

function createSourceConfig() {
  return {
    scene: {
      backgroundColor: '#b7d0dc',
      fogColor: '#b7d0dc',
      fogNear: 24,
      fogFar: 62,
      groundColor: '#789958',
      groundSize: 72,
    },
    camera: { fieldOfView: 42, near: 0.1, far: 120, position: [12, 8, 16], target: [0, 4, 0] },
    renderer: { maxPixelRatio: 2, shadowMapSize: 2048 },
    lod: { nearPixels: 300, cullPixels: 12, generationBudgetMs: 8 },
    lighting: { sunPosition: [11, 17, 9] },
    layout: [{ preset: 'tallOne', seed: 10, position: [0, 0, 0] }],
  };
}

test('a forest is the same forest every time it is asked for', () => {
  const source = createSourceConfig();
  const first = createForestSceneConfig(source, { presets: PRESETS });
  const second = createForestSceneConfig(source, { presets: PRESETS });

  assert.deepEqual(first.layout, second.layout);
  assert.equal(first.layout.length, first.forest.treeCount);
  assert.ok(first.layout.length > 60, `expected a populated forest, got ${first.layout.length}`);
  assert.equal(source.layout.length, 1);
});

test('a different seed lays the same size of forest out differently', () => {
  const source = createSourceConfig();
  const first = createForestSceneConfig(source, { presets: PRESETS, seed: 11 });
  const second = createForestSceneConfig(source, { presets: PRESETS, seed: 12 });

  assert.notDeepEqual(first.layout, second.layout);
});

test('forest variants are bounded per species while instance transforms stay unique', () => {
  const maximumPerSpecies = 3;
  const { layout, forest } = createForestSceneConfig(createSourceConfig(), {
    presets: PRESETS,
    seed: 41,
    variantPolicy: { maximumPerSpecies },
  });
  const seedsByPreset = new Map();

  for (const entry of layout) {
    if (!seedsByPreset.has(entry.preset)) seedsByPreset.set(entry.preset, new Set());
    seedsByPreset.get(entry.preset).add(entry.seed);
    assert.ok(entry.variantIndex >= 0 && entry.variantIndex < maximumPerSpecies);
  }

  assert.equal(forest.variantCountPerSpecies, maximumPerSpecies);
  assert.ok(
    [...seedsByPreset.values()].every((seeds) => seeds.size <= maximumPerSpecies),
  );
  assert.ok(new Set(layout.map((entry) => entry.rotationY)).size > maximumPerSpecies);
});

test('forest instance scale spread comes from the variant policy', () => {
  const { layout } = createForestSceneConfig(createSourceConfig(), {
    presets: PRESETS,
    variantPolicy: {
      maximumPerSpecies: 3,
      scaleRange: [0.91, 0.91],
    },
  });

  assert.ok(layout.length > 0);
  assert.ok(layout.every((entry) => entry.scale === 0.91));
  assert.throws(
    () =>
      createForestSceneConfig(createSourceConfig(), {
        presets: PRESETS,
        variantPolicy: {
          maximumPerSpecies: 3,
          scaleRange: [1.1, 0.9],
        },
      }),
    /scaleRange/,
  );
});

test('the clearing stays clear apart from the bushes standing in it', () => {
  const size = resolveForestSize(DEFAULT_FOREST_SIZE);
  const { layout } = createForestSceneConfig(createSourceConfig(), { presets: PRESETS });
  const inside = layout.filter(
    (entry) => Math.hypot(entry.position[0], entry.position[2]) < size.clearingRadius,
  );

  assert.ok(inside.length > 0, 'the clearing should not be bare');
  assert.ok(inside.every((entry) => entry.preset === 'bush'));
  assert.ok(
    layout.every(
      (entry) => Math.hypot(entry.position[0], entry.position[2]) <= size.radius,
    ),
  );
});

test('trees are grown from the clearing outwards', () => {
  const { layout } = createForestSceneConfig(createSourceConfig(), { presets: PRESETS });
  const distances = layout.map((entry) =>
    Math.hypot(entry.position[0], entry.position[2]),
  );

  assert.deepEqual(distances, [...distances].sort((first, second) => first - second));
});

test('trees beyond the hero radius never build their near levels', () => {
  const size = resolveForestSize('deepForest');
  const { layout } = createForestSceneConfig(createSourceConfig(), {
    presets: PRESETS,
    size: 'deepForest',
  });

  for (const entry of layout) {
    const distance = Math.hypot(entry.position[0], entry.position[2]);
    assert.equal(entry.minimumLod, distance > size.heroRadius ? 2 : 0);
  }
});

test('a bigger forest reaches further and sees further', () => {
  const source = createSourceConfig();
  const glade = createForestSceneConfig(source, { presets: PRESETS, size: 'glade' });
  const deep = createForestSceneConfig(source, { presets: PRESETS, size: 'deepForest' });

  assert.ok(deep.layout.length > glade.layout.length);
  assert.ok(deep.camera.far > glade.camera.far);
  assert.ok(deep.scene.fogFar > glade.scene.fogFar);
  assert.ok(deep.scene.groundSize > deep.forest.radius * 2);
  assert.ok(glade.forest.walkRadius < glade.scene.groundSize * 0.5);
  assert.equal(glade.lighting.followFocus, true);
  assert.equal(glade.lighting.sunPosition, source.lighting.sunPosition);
  assert.equal(glade.scene.fogFar < glade.camera.far, true);
});

test('every layer plants something even when the presets fill only one', () => {
  const { layout } = createForestSceneConfig(createSourceConfig(), {
    presets: [{ id: 'onlyOne', height: 7 }],
  });

  assert.ok(layout.length > 0);
  assert.ok(layout.every((entry) => entry.preset === 'onlyOne'));
});

test('a forest cannot be laid out without presets', () => {
  assert.throws(
    () => createForestSceneConfig(createSourceConfig(), { presets: [] }),
    /at least one tree preset/,
  );
});

test('an unknown size falls back to the default', () => {
  assert.equal(resolveForestSize('nonsense'), FOREST_SIZES[DEFAULT_FOREST_SIZE]);
  assert.equal(isForestSceneRequested('?scene=forest'), true);
  assert.equal(isForestSceneRequested('?scene=garden'), false);
});
