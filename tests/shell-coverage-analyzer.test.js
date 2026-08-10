import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { SpatialHashGrid } from '../src/generation/spatial-hash-grid.js';
import { analyzeShellCoverage } from '../src/qa/shell-coverage-analyzer.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const PROBE_OPTIONS = Object.freeze({
  probeDensityMultiplier: 2,
  probeExposureMargin: 0.05,
});

test('a spatial hash grid finds entries within its cell neighbourhood', () => {
  const grid = new SpatialHashGrid(1);
  grid.insert({ x: 0, y: 0, z: 0 }, 'origin');
  grid.insert({ x: 5, y: 0, z: 0 }, 'far');

  assert.equal(grid.size(), 2);
  assert.equal(grid.findNear({ x: 0.4, y: 0.2, z: 0 }, () => true), 'origin');
  assert.equal(grid.findNear({ x: 5.1, y: 0, z: 0 }, () => true), 'far');
  assert.equal(grid.findNear({ x: 50, y: 50, z: 50 }, () => true), null);
});

test('a wider ring reaches entries a single ring misses', () => {
  const grid = new SpatialHashGrid(1);
  grid.insert({ x: 4.5, y: 0, z: 0 }, 'target');

  assert.equal(grid.forEachNear({ x: 0, y: 0, z: 0 }, 1, () => true), null);
  assert.equal(grid.forEachNear({ x: 0, y: 0, z: 0 }, 5, () => true), 'target');
});

test('a grid requires a positive cell size', () => {
  assert.throws(() => new SpatialHashGrid(0), /positive cell size/);
});

test('every lobe carries clusters and no probe is left beyond a card width', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 8128);
  const metrics = analyzeShellCoverage(tree, preset, PROBE_OPTIONS);

  assert.equal(metrics.bareExposedLobes, 0);
  assert.equal(metrics.candidateCoverageRatio, tree.shellCandidateCoverageRatio);
  assert.ok(metrics.probeCount > 0);
  assert.ok(metrics.clusterCount > 0);
  assert.ok(Number.isFinite(metrics.maximumGap));
  assert.ok(
    metrics.gapCardRatio < 1,
    `worst gap ${metrics.maximumGap} exceeds a card width`,
  );
});

test('coverage analysis is deterministic for a seed', () => {
  const preset = createTestPreset();
  const generator = new TreeGenerator();
  const first = analyzeShellCoverage(
    generator.generate(preset, 3301),
    preset,
    PROBE_OPTIONS,
  );
  const second = analyzeShellCoverage(
    generator.generate(preset, 3301),
    preset,
    PROBE_OPTIONS,
  );

  assert.deepEqual(first, second);
});

test('removing clusters is reported as a larger gap', () => {
  const preset = createTestPreset();
  const tree = new TreeGenerator().generate(preset, 8128);
  const full = analyzeShellCoverage(tree, preset, PROBE_OPTIONS);
  const thinned = analyzeShellCoverage(
    { ...tree, shell: tree.shell.filter((instance) => instance.id % 4 === 0) },
    preset,
    PROBE_OPTIONS,
  );

  assert.ok(
    thinned.maximumGap > full.maximumGap,
    'thinning the shell must widen the measured gap',
  );
  assert.ok(thinned.gapCardRatio > full.gapCardRatio);
});
