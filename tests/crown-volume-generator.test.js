import assert from 'node:assert/strict';
import test from 'node:test';
import { CrownVolumeField } from '../src/generation/crown-volume-field.js';
import { CrownVolumeGenerator } from '../src/generation/crown-volume-generator.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const NORMAL_TOLERANCE = 1e-5;
const EDGE_LENGTH_MULTIPLIER = 1.9;
const POSITION_PRECISION = 5;

function arrayBufferEquals(left, right) {
  return Buffer.from(left.buffer).equals(Buffer.from(right.buffer));
}

function distance(positions, left, right) {
  const leftOffset = left * 3;
  const rightOffset = right * 3;
  return Math.hypot(
    positions[leftOffset] - positions[rightOffset],
    positions[leftOffset + 1] - positions[rightOffset + 1],
    positions[leftOffset + 2] - positions[rightOffset + 2],
  );
}

function positionKey(positions, index) {
  const offset = index * 3;
  return [positions[offset], positions[offset + 1], positions[offset + 2]]
    .map((value) => value.toFixed(POSITION_PRECISION))
    .join(':');
}

test('unified crown generation is exactly deterministic', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 3407);
  const generator = new CrownVolumeGenerator();
  const first = generator.generate(tree);
  const replay = generator.generate(tree);

  assert.equal(first.triangleCount, replay.triangleCount);
  assert.equal(first.vertexCount, replay.vertexCount);
  assert.equal(arrayBufferEquals(first.positions, replay.positions), true);
  assert.equal(arrayBufferEquals(first.normals, replay.normals), true);
});

test('unified crown is finite smooth and free from long spikes', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 9917);
  const volume = new CrownVolumeGenerator().generate(tree);
  let maximumEdgeLength = 0;
  let maximumNormalError = 0;
  const coincidentNormals = new Map();

  assert.ok(volume.triangleCount > 500);
  assert.equal(volume.vertexCount, volume.triangleCount * 3);

  for (let index = 0; index < volume.positions.length; index += 1) {
    assert.equal(Number.isFinite(volume.positions[index]), true);
  }

  for (let vertex = 0; vertex < volume.vertexCount; vertex += 1) {
    const offset = vertex * 3;
    const normal = [
      volume.normals[offset],
      volume.normals[offset + 1],
      volume.normals[offset + 2],
    ];
    const normalError = Math.abs(Math.hypot(...normal) - 1);
    maximumNormalError = Math.max(maximumNormalError, normalError);

    const key = positionKey(volume.positions, vertex);
    const existing = coincidentNormals.get(key);
    if (existing) {
      assert.ok(
        Math.hypot(
          normal[0] - existing[0],
          normal[1] - existing[1],
          normal[2] - existing[2],
        ) <= NORMAL_TOLERANCE,
      );
    } else {
      coincidentNormals.set(key, normal);
    }
  }

  for (let triangle = 0; triangle < volume.triangleCount; triangle += 1) {
    const first = triangle * 3;
    maximumEdgeLength = Math.max(
      maximumEdgeLength,
      distance(volume.positions, first, first + 1),
      distance(volume.positions, first + 1, first + 2),
      distance(volume.positions, first + 2, first),
    );
  }

  assert.ok(maximumNormalError <= NORMAL_TOLERANCE);
  assert.ok(
    maximumEdgeLength <= volume.grid.cellSize * EDGE_LENGTH_MULTIPLIER,
  );
});

test('implicit crown field contains every control lobe and clears its bounds', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 8111);
  const field = new CrownVolumeField(tree);

  for (const lobe of tree.lobes) {
    assert.ok(field.sample(lobe.position) < 0);
  }

  const { minimum, maximum } = field.bounds;
  const corners = [
    { x: minimum.x, y: minimum.y, z: minimum.z },
    { x: maximum.x, y: minimum.y, z: minimum.z },
    { x: minimum.x, y: maximum.y, z: minimum.z },
    { x: minimum.x, y: minimum.y, z: maximum.z },
    { x: maximum.x, y: maximum.y, z: maximum.z },
  ];

  for (const corner of corners) {
    assert.ok(field.sample(corner) > 0);
  }
});
