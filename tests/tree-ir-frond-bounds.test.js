import assert from 'node:assert/strict';
import test from 'node:test';
import { expandTreeIrFrondBounds } from '../src/generation/tree-ir-frond-bounds.js';

function createBounds() {
  return {
    minimum: { x: 0, y: 0, z: 0 },
    maximum: { x: 0, y: 0, z: 0 },
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
  const bounds = expandTreeIrFrondBounds(createBounds(), SITE, { sampleCount: 16 });

  assert.ok(bounds.maximum.x >= 5);
  assert.ok(bounds.minimum.z < 2);
  assert.ok(bounds.maximum.z > 2);
  assert.ok(bounds.maximum.y > 5);
});

test('frond bounds include droop below the attachment height', () => {
  const bounds = expandTreeIrFrondBounds(createBounds(), SITE, { sampleCount: 16 });

  assert.ok(bounds.minimum.y < 5);
});

test('sites without frond metadata do not alter bounds', () => {
  const bounds = createBounds();
  assert.equal(expandTreeIrFrondBounds(bounds, { metadata: {} }), bounds);
  assert.deepEqual(bounds, createBounds());
});

test('frond bounds validate sample count', () => {
  assert.throws(
    () => expandTreeIrFrondBounds(createBounds(), SITE, { sampleCount: 0 }),
    /positive integer/,
  );
});
