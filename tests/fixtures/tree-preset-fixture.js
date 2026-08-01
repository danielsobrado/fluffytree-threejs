import { createTreePreset } from '../../src/domain/tree-preset.js';

export function createTestPreset(overrides = {}) {
  const shellOverrides = overrides.foliage?.shell ?? {};

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
      palette: ['#23382d', '#335533', '#668855', '#aacc77'],
      variation: 0.2,
      paletteBase: 0.48,
      heightPaletteShift: 0.18,
      exposurePaletteShift: 0.12,
      radialNormalStrength: 0.78,
      wrapLight: 0.5,
      skyLightStrength: 0.2,
      cavityStrength: 0.34,
      heightLightStrength: 0.14,
      ...overrides.foliage,
      shell: {
        instancesPerLobe: 12,
        candidateMultiplier: 3,
        sizeRatio: [0.15, 0.24],
        radialOffsetRatio: 0.045,
        exposureThreshold: 0.08,
        alphaTest: 0.46,
        planesPerCluster: 3,
        shadowProxyScale: 0.97,
        ...shellOverrides,
      },
    },
    ...overrides.root,
  });
}
