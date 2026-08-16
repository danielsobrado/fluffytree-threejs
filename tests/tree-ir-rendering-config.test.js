import assert from 'node:assert/strict';
import test from 'node:test';
import { parseTreeIrRenderingConfig } from '../src/rendering/tree-ir-rendering-config.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const config = readYamlConfigSync(
  new URL('../config/tree-ir-rendering.yaml', import.meta.url),
);

test('direct Tree IR rendering policy parses into immutable role settings', () => {
  const parsed = parseTreeIrRenderingConfig(config);

  assert.equal(parsed.structure.hero.radialSegments, 10);
  assert.equal(parsed.structure.aggregate.branchCurveSamples, 4);
  assert.equal(parsed.foliage.heroCardPlanes, 2);
  assert.equal(parsed.foliage.frondNearSegmentRatio, 0.58);
  assert.equal(Object.isFrozen(parsed.structure.hero), true);
});

test('direct Tree IR rendering policy rejects invalid quality values', () => {
  const invalid = structuredClone(config);
  invalid.directIr.foliage.alphaResolution = 8;
  assert.throws(() => parseTreeIrRenderingConfig(invalid), /alphaResolution/);
});
