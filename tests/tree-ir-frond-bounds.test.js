import assert from 'node:assert/strict';
import test from 'node:test';
import { expandTreeIrFrondBounds } from '../src/generation/tree-ir-frond-bounds.js';

const EPSILON = 1e-10;

function createBounds() {
  return {
    minimum: {
      x: Number.POSITIVE_INFINITY,
      y: Number.POSITIVE_INFINITY,
      z: Number.POSITIVE_INFINITY,
    },
    maximum: {
      x: Number.NEGATIVE_INFINITY,
      y: Number.NEGATIVE_INFINITY,
      z: Number.NEGATIVE_INFINITY,
    },
  };
}

function frondPoint(site, ratio, side) {
  const frond = site.metadata.frond;
  const forwardX = Math.cos(frond.azimuth);
  const forwardZ = Math.sin(frond.azimuth);
  const sideX = -forwardZ;
  const sideZ = forwardX;
  const widthEnvelope = 0.08 + 0.92 * Math.sin(Math.PI * ratio) ** 0.65;
  const halfWidth = frond.width * widthEnvelope * 0.5 * side;
  return {
    x:
      site.frame.position.x +
      forwardX * frond.length * ratio +
      sideX * halfWidth,
    y:
      site.frame.position.y +
      frond.length *
        (frond.rise * ratio - frond.droop * 0.68 * ratio * ratio),
    z:
      site.frame.position.z +
      forwardZ * frond.length * ratio +
      sideZ * halfWidth,
  };
}

const SITE = Object.freeze({
  frame: Object.freeze({
    position: Object.freeze({ x: 1, y: 5, z: 2 }),
  }),
  metadata: Object.freeze({
    frond: Object.freeze({
      azimuth: 0,
      length: 4,
      width: 1,
      rise: 0.2,
      droop: 0.5,
    }),
  }),
});

test('frond bounds include full horizontal length and ribbon width', () => {
  const bounds = expandTreeIrFrondBounds(createBounds(), SITE);

  assert.equal(bounds.maximum.x, 5);
  assert.equal(bounds.minimum.z, 1.5);
  assert.equal(bounds.maximum.z, 2.5);
});

test('frond bounds include the exact quadratic vertical extremum', () => {
  const bounds = expandTreeIrFrondBounds(createBounds(), SITE);
  const stationaryRatio = 0.2 / (2 * 0.5 * 0.68);
  const expectedMaximum =
    5 + 4 * (0.2 * stationaryRatio - 0.5 * 0.68 * stationaryRatio ** 2);

  assert.ok(Math.abs(bounds.maximum.y - expectedMaximum) <= EPSILON);
  assert.ok(Math.abs(bounds.minimum.y - 4.44) <= EPSILON);
});

test('frond bounds contain densely sampled rendered ribbon geometry', () => {
  const site = {
    frame: { position: { x: -1.2, y: 7.3, z: 2.4 } },
    metadata: {
      frond: {
        azimuth: 0.73,
        length: 5.6,
        width: 0.95,
        rise: 0.46,
        droop: 0.48,
      },
    },
  };
  const bounds = expandTreeIrFrondBounds(createBounds(), site);

  for (let index = 0; index <= 1000; index += 1) {
    const ratio = index / 1000;
    for (const side of [-1, 1]) {
      const point = frondPoint(site, ratio, side);
      assert.ok(point.x >= bounds.minimum.x - EPSILON);
      assert.ok(point.x <= bounds.maximum.x + EPSILON);
      assert.ok(point.y >= bounds.minimum.y - EPSILON);
      assert.ok(point.y <= bounds.maximum.y + EPSILON);
      assert.ok(point.z >= bounds.minimum.z - EPSILON);
      assert.ok(point.z <= bounds.maximum.z + EPSILON);
    }
  }
});

test('sites without frond metadata do not alter bounds', () => {
  const bounds = createBounds();
  const before = structuredClone(bounds);

  assert.equal(expandTreeIrFrondBounds(bounds, { metadata: {} }), bounds);
  assert.deepEqual(bounds, before);
});
