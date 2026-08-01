const STRESS_TREE_COUNT = 75;

export function isStressSceneRequested(search = window.location.search) {
  return new URLSearchParams(search).get('qa') === 'stress';
}

export function createStressSceneConfig(config) {
  const presets = config.layout.map((entry) => entry.preset);
  const layout = [];
  for (let row = 0; row < 5; row += 1) {
    for (let column = 0; column < 15; column += 1) {
      const index = row * 15 + column;
      const source = config.layout[index % config.layout.length];
      layout.push({
        preset: presets[index % presets.length],
        seed: Number(source.seed) + index * 7919,
        position: [(column - 7) * 8, 0, -190 + row * 15],
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
