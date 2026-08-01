import assert from 'node:assert/strict';
import test from 'node:test';
import { CanopyClosureSampler } from '../src/rendering/canopy-closure-sampler.js';

function createTreeData() {
  return {
    seed: 12345,
    lobes: [
      {
        id: 0,
        position: { x: 0, y: 2, z: 0 },
        scale: { x: 1.2, y: 1.1, z: 1.2 },
        colorMix: 0.35,
      },
      {
        id: 1,
        position: { x: 0.1, y: 3.4, z: -0.05 },
        scale: { x: 1.1, y: 1.2, z: 1.05 },
        colorMix: 0.5,
      },
      {
        id: 2,
        position: { x: -0.05, y: 4.8, z: 0.08 },
        scale: { x: 0.9, y: 1, z: 0.9 },
        colorMix: 0.7,
      },
    ],
    trunk: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0.02, y: 2.5, z: 0 },
        { x: 0.04, y: 5.8, z: 0.02 },
      ],
    },
    palette: {
      leafDetail: {
        closure: {
          enabled: true,
          volumeSlices: 6,
          samplesPerSlice: 8,
          trunkSlices: 6,
          trunkRingCount: 3,
          saddleSamples: 2,
          capLayers: 2,
          capSamplesPerLayer: 6,
          microLayerCount: 2,
          radiusRatio: 0.82,
          trunkRadiusRatio: 0.3,
          clusterScaleRatio: 0.12,
          colorDrop: 0.14,
          axialJitter: 0.15,
          depthJitterRatio: 0.18,
        },
      },
    },
  };
}

function createField() {
  return {
    bounds: {
      minimum: { x: -1.5, y: 0.8, z: -1.5 },
      maximum: { x: 1.5, y: 6, z: 1.5 },
    },
    crownHeight: 5.2,
    sample: () => -0.5,
  };
}

test('canopy closure creates all volumetric roles deterministically', () => {
  const sampler = new CanopyClosureSampler();
  const first = sampler.generate(createTreeData(), createField());
  const second = sampler.generate(createTreeData(), createField());

  assert.deepEqual(first, second);
  for (const role of ['volume', 'trunk', 'saddle', 'cap']) {
    assert.ok(first.some((sample) => sample.role === role), role);
  }
  assert.ok(first.length > 70);
  assert.ok(first.every((sample) => sample.scale > 0));
});

test('canopy closure can be disabled without changing the outer shell', () => {
  const treeData = createTreeData();
  treeData.palette.leafDetail.closure.enabled = false;

  const samples = new CanopyClosureSampler().generate(treeData, createField());

  assert.deepEqual(samples, []);
});
