import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createSweepFrames,
  createSweepParameters,
} from '../src/rendering/swept-tube-sampling.js';
import {
  analyzeGeometryBoundary,
  calculateSignedVolume,
} from '../src/qa/geometry-boundary-analyzer.js';

function dot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function length(vector) {
  return Math.hypot(vector.x, vector.y, vector.z);
}

test('unbiased sweep parameters are evenly spaced', () => {
  assert.deepEqual(createSweepParameters(4), [0, 0.25, 0.5, 0.75, 1]);
});

test('a biased sweep concentrates rings at the flared start', () => {
  const parameters = createSweepParameters(8, 1.6);

  assert.equal(parameters[0], 0);
  assert.equal(parameters.at(-1), 1);
  assert.ok(parameters[1] < 0.125, 'the first ring should hug the start');
  for (let index = 1; index < parameters.length; index += 1) {
    assert.ok(parameters[index] > parameters[index - 1], 'must stay ascending');
  }
});

test('sweep frames stay orthonormal and right handed', () => {
  const tangents = [
    { x: 0, y: 1, z: 0 },
    { x: 0.2, y: 0.98, z: 0 },
    { x: 0.3, y: 0.9, z: 0.31 },
    { x: 0, y: 0.7, z: 0.71 },
  ];
  const { normals, binormals } = createSweepFrames(tangents);

  tangents.forEach((rawTangent, index) => {
    const scale = length(rawTangent);
    const tangent = {
      x: rawTangent.x / scale,
      y: rawTangent.y / scale,
      z: rawTangent.z / scale,
    };
    const normal = normals[index];
    const binormal = binormals[index];

    assert.ok(Math.abs(length(normal) - 1) < 1e-9);
    assert.ok(Math.abs(length(binormal) - 1) < 1e-9);
    assert.ok(Math.abs(dot(normal, tangent)) < 1e-9);
    assert.ok(Math.abs(dot(normal, binormal)) < 1e-9);
    // normal x binormal == tangent keeps every ring wound the same way, which is
    // what stops a run of triangles from facing into the tube.
    const cross = {
      x: normal.y * binormal.z - normal.z * binormal.y,
      y: normal.z * binormal.x - normal.x * binormal.z,
      z: normal.x * binormal.y - normal.y * binormal.x,
    };
    assert.ok(Math.abs(dot(cross, tangent) - 1) < 1e-9);
  });
});

test('frames rotate as little as possible between rings', () => {
  const tangents = [
    { x: 0, y: 1, z: 0 },
    { x: 0.05, y: 1, z: 0 },
    { x: 0.1, y: 1, z: 0 },
  ];
  const { normals } = createSweepFrames(tangents);

  assert.ok(dot(normals[0], normals[1]) > 0.99);
  assert.ok(dot(normals[1], normals[2]) > 0.99);
});

test('a degenerate tangent list is rejected', () => {
  assert.throws(() => createSweepFrames([{ x: 0, y: 1, z: 0 }]), /at least two/);
  assert.throws(
    () => createSweepFrames([{ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 0 }]),
    /zero length/,
  );
});

test('boundary analysis separates a closed surface from an open rim', () => {
  // A tetrahedron: four triangles, six shared edges, nothing open.
  const closed = analyzeGeometryBoundary([0, 2, 1, 0, 1, 3, 1, 2, 3, 2, 0, 3]);
  assert.equal(closed.triangleCount, 4);
  assert.equal(closed.edgeCount, 6);
  assert.equal(closed.boundaryEdges, 0);
  assert.equal(closed.closed, true);

  // Removing one face opens a three edge rim.
  const open = analyzeGeometryBoundary([0, 2, 1, 0, 1, 3, 1, 2, 3]);
  assert.equal(open.boundaryEdges, 3);
  assert.equal(open.closed, false);
});

test('boundary analysis reports non-manifold edges', () => {
  const fan = analyzeGeometryBoundary([0, 1, 2, 0, 1, 3, 0, 1, 4]);
  assert.equal(fan.nonManifoldEdges, 1);
  assert.equal(fan.closed, false);
});

test('signed volume separates an outward tube from an inside-out one', () => {
  // A unit cube centred on the origin, wound so its front faces point outwards.
  const positions = [
    -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1,
    -1, -1, 1, 1, -1, 1, 1, 1, 1, -1, 1, 1,
  ];
  const outward = [
    0, 2, 1, 0, 3, 2,
    4, 5, 6, 4, 6, 7,
    0, 1, 5, 0, 5, 4,
    1, 2, 6, 1, 6, 5,
    2, 3, 7, 2, 7, 6,
    3, 0, 4, 3, 4, 7,
  ];
  const inverted = [];
  for (let offset = 0; offset < outward.length; offset += 3) {
    inverted.push(outward[offset], outward[offset + 2], outward[offset + 1]);
  }

  assert.equal(analyzeGeometryBoundary(outward).closed, true);
  assert.ok(Math.abs(calculateSignedVolume(positions, outward) - 8) < 1e-9);
  assert.ok(Math.abs(calculateSignedVolume(positions, inverted) + 8) < 1e-9);
});
