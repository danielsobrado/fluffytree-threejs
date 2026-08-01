import { createTreePreset } from '../../src/domain/tree-preset.js';

export function createTestPreset(overrides = {}) {
  return createTreePreset('test', {
    label: 'Test',
    height: 7,
    crown: {
      profile: 'round',
      baseHeight: 2.2,
      height: 4.5,
      radius: 2.4,
      lobeCount: 10,
      lobeScale: [0.8, 1.1],
      verticalScale: [0.8, 1.2],
      radialBias: 0.6,
      asymmetry: 0.15,
      lean: [0.1, 0],
      ...overrides.crown,
    },
    trunk: {
      baseRadius: 0.35,
      topRadius: 0.12,
      bend: 0.2,
      segments: 7,
      branchCount: 5,
      color: '#554433',
      ...overrides.trunk,
    },
    foliage: {
      baseColor: '#335533',
      lightColor: '#88aa66',
      variation: 0.2,
      ...overrides.foliage,
    },
    ...overrides.root,
  });
}
