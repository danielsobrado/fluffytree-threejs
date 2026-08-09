const STRESS_TREE_COUNT = 75;
const STRESS_COLUMN_COUNT = 15;
const STRESS_ROW_COUNT = STRESS_TREE_COUNT / STRESS_COLUMN_COUNT;
const STRESS_SEED_STEP = 7919;
const STRESS_TREE_SPACING = 8;
const STRESS_ROW_SPACING = 15;
const STRESS_START_Z = -190;

export function isStressSceneRequested(search = window.location.search) {
  return new URLSearchParams(search).get('qa') === 'stress';
}

export function createStressSceneConfig(config) {
  const presets = config.layout.map((entry) => entry.preset);
  const layout = [];
  for (let row = 0; row < STRESS_ROW_COUNT; row += 1) {
    for (let column = 0; column < STRESS_COLUMN_COUNT; column += 1) {
      const index = row * STRESS_COLUMN_COUNT + column;
      const source = config.layout[index % config.layout.length];
      layout.push({
        preset: presets[index % presets.length],
        seed: (Number(source.seed) + Math.imul(index, STRESS_SEED_STEP)) >>> 0,
        position: [
          (column - (STRESS_COLUMN_COUNT - 1) * 0.5) * STRESS_TREE_SPACING,
          0,
          STRESS_START_Z + row * STRESS_ROW_SPACING,
        ],
        rotationY: (index * 2.399963229728653) % (Math.PI * 2),
      });
    }
  }
  return {
    ...config,
    scene: {
      ...config.scene,
      fogNear: 180,
      fogFar: 265,
      groundSize: 520,
    },
    camera: {
      ...config.camera,
      far: 360,
      position: [0, 36, 55],
      target: [0, 5, -155],
      controlsMaxDistance: 320,
    },
    renderer: {
      ...config.renderer,
      maxPixelRatio: 1,
      shadowMapSize: 1024,
    },
    lod: {
      ...config.lod,
      generationBudgetMs: 32,
    },
    layout,
  };
}

export { STRESS_TREE_COUNT };
