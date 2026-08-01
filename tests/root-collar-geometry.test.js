import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RootCollarGeometryFactory,
  trimPathAboveHeight,
} from '../src/rendering/root-collar-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from '../src/rendering/tree-structure-rendering-constants.js';

const trunkPath = Object.freeze([
  { x: 0, y: 0, z: 0 },
  { x: 0.05, y: 0.8, z: 0.02 },
  { x: 0.12, y: 1.6, z: 0.04 },
  { x: 0.18, y: 2.4, z: 0.08 },
]);

test('root collar extends below and above the terrain plane', () => {
  const geometry = new RootCollarGeometryFactory().create({
    path: trunkPath,
    startRadius: 0.35,
    flare: 0.45,
    seed: 123,
  });

  assert.ok(geometry.boundingBox.min.y < 0);
  assert.ok(geometry.boundingBox.max.y > 0);
  assert.equal(geometry.userData.rootCollar.capped, true);
  assert.equal(
    geometry.userData.rootCollar.embeddedDepth,
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
  );
  geometry.dispose();
});

test('trunk continuation starts at the root collar height', () => {
  const trimmed = trimPathAboveHeight(
    trunkPath,
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight,
  );

  assert.equal(
    trimmed[0].y,
    TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight,
  );
  assert.ok(trimmed.every((point) => point.y >= trimmed[0].y));
});
