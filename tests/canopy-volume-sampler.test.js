import assert from 'node:assert/strict';
import test from 'node:test';
import { CanopyVolumeSampler } from '../src/rendering/canopy-volume-sampler.js';

function createTreeData() {
  return {
    seed: 37,
    lobes: [
      {
        id: 0,
        position: { x: 0, y: 2.2, z: 0 },
        scale: { x: 1.2, y: 1.3, z: 1.1 },
        colorMix: 0.4,
      },
      {
        id: 1,
        position: { x: 0.1, y: 3.7, z: 0 },
        scale: { x: 1, y: 1.2, z: 1 },
        colorMix: 0.6,
      },
    ],
    trunk: {
      points: [
        { x: 0, y: 0, z: 0 },
        { x: 0.05, y: 2, z: 0 },
        { x: 0.08, y: 3.4, z: 0.02 },
      ],
    },
  };
}

function createField() {
  return {
    bounds: {
      minimum: { x: -1.5, y: 0.7, z: -1.5 },
      maximum: { x: 1.5, y: 5.2, z: 1.5 },
    },
    crownHeight: 4.5,
    sample: () => -0.5,
  };
}

const SETTINGS = Object.freeze({
  volumeSlices: 6,
  samplesPerSlice: 6,
  trunkSlices: 8,
  trunkRingCount: 3,
  radiusRatio: 0.85,
  trunkRadiusRatio: 0.3,
  clusterScaleRatio: 0.1,
  colorDrop: 0.14,
  axialJitter: 0.1,
});

test('trunk closure uses every requested slice without extending beyond the trunk', () => {
  const samples = new CanopyVolumeSampler().generate(
    createTreeData(),
    createField(),
    SETTINGS,
  );
  const trunk = samples.filter((sample) => sample.role === 'trunk');

  assert.equal(trunk.length, SETTINGS.trunkSlices * (SETTINGS.trunkRingCount + 1));
  assert.ok(trunk.every((sample) => sample.position.y <= 3.4));
  assert.ok(trunk.every((sample) => sample.position.y >= 1.06));
});
