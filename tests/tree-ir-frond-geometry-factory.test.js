import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeIrFrondGeometryFactory } from '../src/rendering/tree-ir-frond-geometry-factory.js';

const TREE_IR = Object.freeze({
  seed: 77,
  metadata: Object.freeze({
    material: Object.freeze({
      foliagePalette: Object.freeze(['#21452f', '#4f7d4c', '#88a86d']),
    }),
  }),
});

const SITE = Object.freeze({
  id: 'foliage:frond:0',
  frame: Object.freeze({
    position: Object.freeze({ x: 0, y: 5, z: 0 }),
  }),
  metadata: Object.freeze({
    frond: Object.freeze({
      azimuth: 0,
      length: 4,
      width: 1,
      rise: 0.25,
      droop: 0.45,
      segmentCount: 4,
    }),
  }),
});

test('hero palm leaflets create a feathered frond with a continuous rachis', () => {
  const factory = new TreeIrFrondGeometryFactory();
  const ribbon = factory.create(TREE_IR, SITE);
  const leaflets = factory.create(TREE_IR, SITE, {
    leaflets: true,
    rachisWidthRatio: 0.075,
    leafletLengthRatio: 0.95,
    leafletWidthRatio: 0.68,
  });

  try {
    assert.equal(ribbon.getAttribute('position').count, 10);
    assert.equal(ribbon.index.count, 24);
    assert.equal(leaflets.getAttribute('position').count, 34);
    assert.equal(leaflets.index.count, 48);
    assert.ok(leaflets.boundingBox.max.x >= ribbon.boundingBox.max.x * 0.99);
    assert.ok(leaflets.boundingBox.min.z < 0);
    assert.ok(leaflets.boundingBox.max.z > 0);
  } finally {
    ribbon.dispose();
    leaflets.dispose();
  }
});

test('frond geometry anchors wind at the crown and increases motion toward the tip', () => {
  const geometry = new TreeIrFrondGeometryFactory().create(TREE_IR, SITE);

  try {
    const weights = geometry.getAttribute('treeFrondWindWeight');
    const phases = geometry.getAttribute('treeFrondWindPhase');
    assert.equal(weights.count, geometry.getAttribute('position').count);
    assert.equal(phases.count, weights.count);
    assert.equal(weights.getX(0), 0);
    assert.equal(weights.getX(1), 0);
    assert.equal(weights.getX(weights.count - 1), 1);
    assert.equal(
      phases.getX(0),
      phases.getX(phases.count - 1),
    );
  } finally {
    geometry.dispose();
  }
});

test('frond geometry reduces segment cost for lower LODs', () => {
  const factory = new TreeIrFrondGeometryFactory();
  const hero = factory.create(TREE_IR, SITE);
  const reduced = factory.create(TREE_IR, SITE, { segmentRatio: 0.5 });

  try {
    assert.ok(reduced.index.count < hero.index.count);
  } finally {
    hero.dispose();
    reduced.dispose();
  }
});
