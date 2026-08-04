import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedRotatedPointDistance } from '../src/generation/lobe-geometry.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createFoliageAlphaProfile } from '../src/rendering/foliage-alpha-profile.js';
import { FOLIAGE_RENDERING_CONSTANTS } from '../src/rendering/foliage-rendering-constants.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const NORMAL_TOLERANCE = 1e-9;
const COVERAGE_TOLERANCE = 1e-12;

function groupByLobe(instances) {
  const groups = new Map();

  for (const instance of instances) {
    const group = groups.get(instance.lobeId) ?? [];
    group.push(instance);
    groups.set(instance.lobeId, group);
  }

  return groups;
}

test('every lobe carries clusters and exposed candidates satisfy max-cover', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 8128);
  const groups = groupByLobe(tree.shell);

  assert.ok(tree.shell.length > 0);
  assert.ok(
    tree.shellCandidateCoverageRatio <= 1 + COVERAGE_TOLERANCE,
    `candidate coverage ratio ${tree.shellCandidateCoverageRatio}`,
  );
  for (const lobe of tree.lobes) {
    const count = groups.get(lobe.id)?.length ?? 0;
    assert.ok(count >= 1, `lobe ${lobe.id} rendered as bare core`);
    assert.ok(count <= preset.foliage.shell.candidatesPerLobe);
  }
  assert.ok(
    tree.shell.every(
      (instance) =>
        instance.exposure >= preset.foliage.shell.exposureThreshold,
    ),
  );
});

test('packing radius and guaranteed alpha radius are tracked separately', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 8128);
  const profile = createFoliageAlphaProfile({
    shapeId: preset.foliage.leafShape,
    alphaTest: preset.foliage.shell.alphaTest,
    planesPerCluster: preset.foliage.shell.planesPerCluster,
  });
  const widths = new Set();

  for (const instance of tree.shell) {
    const cardWidth =
      instance.shellScale *
      instance.widthRatio *
      FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;
    widths.add(cardWidth);

    assert.ok(Math.abs(instance.cardWidth - cardWidth) <= COVERAGE_TOLERANCE);
    assert.ok(
      Math.abs(
        instance.coverageRadius -
          cardWidth * preset.foliage.shell.coverageCardRatio,
      ) <= COVERAGE_TOLERANCE,
    );
    assert.ok(
      Math.abs(
        instance.alphaCoverageRadius -
          cardWidth * profile.guaranteedRadiusRatio,
      ) <= COVERAGE_TOLERANCE,
    );
    assert.equal(instance.leafShape, profile.shapeId);
    assert.equal(instance.alphaTest, profile.alphaTest);
    assert.equal(instance.planesPerCluster, profile.planesPerCluster);
  }

  assert.ok(widths.size > 1, 'card widths should vary between clusters');
});

test('foliage shell fins sit outside their source lobe with valid dimensions', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 9981);

  for (const instance of tree.shell) {
    const lobe = tree.lobes.find((candidate) => candidate.id === instance.lobeId);
    assert.ok(lobe);

    const surfaceDistance = normalizedRotatedPointDistance(instance.position, lobe);
    assert.ok(surfaceDistance > 1);
    assert.ok(surfaceDistance < 1.2);

    const normalLength = Math.hypot(
      instance.normal.x,
      instance.normal.y,
      instance.normal.z,
    );
    const renderedCardWidth =
      instance.shellScale *
      instance.widthRatio *
      FOLIAGE_RENDERING_CONSTANTS.shellCardScaleMultiplier;

    assert.ok(Math.abs(normalLength - 1) <= NORMAL_TOLERANCE);
    assert.ok(instance.exposure >= 0 && instance.exposure <= 1);
    assert.ok(instance.exposure >= preset.foliage.shell.exposureThreshold);
    assert.ok(Number.isFinite(instance.clearance));
    assert.ok(instance.colorMix >= 0 && instance.colorMix <= 1);
    assert.ok(instance.scale > 0);
    assert.ok(instance.shellScale > 0);
    assert.ok(instance.widthRatio >= preset.foliage.shell.widthRatio[0]);
    assert.ok(instance.widthRatio <= preset.foliage.shell.widthRatio[1]);
    assert.ok(instance.outwardRatio >= preset.foliage.shell.outwardRatio[0]);
    assert.ok(instance.outwardRatio <= preset.foliage.shell.outwardRatio[1]);
    assert.ok(
      Math.abs(instance.cardWidth - renderedCardWidth) <= COVERAGE_TOLERANCE,
    );
    assert.ok(
      Math.abs(instance.colorMix - lobe.colorMix) <=
        preset.foliage.shell.colorJitter + Number.EPSILON,
    );
  }
});

test('foliage shell uses a seed stream independent from phase 1 geometry', () => {
  const preset = createTestPreset();
  const generator = new TreeGenerator();
  const tree = generator.generate(preset, 4401);
  const replay = generator.generate(preset, 4401);

  assert.deepEqual(tree.lobes, replay.lobes);
  assert.deepEqual(tree.branches, replay.branches);
  assert.deepEqual(tree.shell, replay.shell);
  assert.equal(
    tree.shellCandidateCoverageRatio,
    replay.shellCandidateCoverageRatio,
  );
  assert.deepEqual(tree.lobeExposure, replay.lobeExposure);
  assert.deepEqual(tree.crownCenter, replay.crownCenter);
});
