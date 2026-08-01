import assert from 'node:assert/strict';
import test from 'node:test';
import { CanopyOccupancyAnalyzer } from '../src/qa/canopy-occupancy-analyzer.js';
import { CanopyClosureSampler } from '../src/rendering/canopy-closure-sampler.js';

function createTreeData() {
  return {
    seed: 12345,
    lobes: [
      {
        id: 0,
        position: { x: 0, y: 2, z: 0 },
        scale: { x: 1.2, y: 1.2, z: 1.2 },
        colorMix: 0.4,
      },
      {
        id: 1,
        position: { x: 0, y: 3.6, z: 0 },
        scale: { x: 1.1, y: 1.2, z: 1.1 },
        colorMix: 0.55,
      },
      {
        id: 2,
        position: { x: 0, y: 5, z: 0 },
        scale: { x: 0.9, y: 1, z: 0.9 },
        colorMix: 0.7,
      },
    ],
    trunk: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0, y: 6, z: 0 },
      ],
    },
    palette: {
      leafDetail: {
        scale: 1.6,
        closure: {
          enabled: true,
          volumeSlices: 12,
          samplesPerSlice: 20,
          trunkSlices: 12,
          trunkRingCount: 4,
          saddleSamples: 3,
          capLayers: 3,
          capSamplesPerLayer: 16,
          microLayerCount: 2,
          radiusRatio: 0.9,
          trunkRadiusRatio: 0.3,
          clusterScaleRatio: 0.1,
          colorDrop: 0.14,
          axialJitter: 0.12,
          depthJitterRatio: 0.18,
        },
      },
    },
  };
}

function createField() {
  return {
    bounds: {
      minimum: { x: -1.3, y: 0.8, z: -1.3 },
      maximum: { x: 1.3, y: 6, z: 1.3 },
    },
    crownHeight: 5.2,
    sample(point) {
      const centerY = 3.4;
      const radius = point.y > 4.5 ? 0.95 : 1.2;
      return (
        Math.hypot(
          point.x / radius,
          (point.y - centerY) / 2.7,
          point.z / radius,
        ) - 1
      );
    },
  };
}

test('occupancy analysis reports deterministic volume and trunk coverage', () => {
  const treeData = createTreeData();
  const field = createField();
  const samples = new CanopyClosureSampler().generate(treeData, field);
  const analyzer = new CanopyOccupancyAnalyzer();
  const first = analyzer.analyze(treeData, field, samples);
  const second = analyzer.analyze(treeData, field, samples);

  assert.deepEqual(first, second);
  assert.ok(first.probeCount > 0);
  assert.ok(first.coverageRatio > 0.55);
  assert.ok(first.trunkCoverageRatio > 0.8);
  assert.ok(first.capCoverageRatio > 0.5);
});
