import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { load } from 'js-yaml';
import { parseCrownVolumeQaConfig } from '../src/qa/crown-volume-qa-config.js';
import { parseTreeShapeQaConfig } from '../src/qa/tree-shape-qa-config.js';

function loadConfig(path) {
  return load(fs.readFileSync(path, 'utf8'));
}

function cloneConfig(path) {
  return structuredClone(loadConfig(path));
}

test('shipped offline QA configurations are valid', () => {
  assert.doesNotThrow(() =>
    parseCrownVolumeQaConfig(loadConfig('config/crown-volume-qa.yaml')),
  );
  assert.doesNotThrow(() =>
    parseTreeShapeQaConfig(loadConfig('config/tree-shape-qa.yaml')),
  );
});

test('crown volume QA rejects invalid seed and determinism settings', () => {
  const zeroSeeds = cloneConfig('config/crown-volume-qa.yaml');
  zeroSeeds.run.seedCount = 0;
  assert.throws(
    () => parseCrownVolumeQaConfig(zeroSeeds),
    /seedCount.*integer/,
  );

  const noReplay = cloneConfig('config/crown-volume-qa.yaml');
  noReplay.run.deterministicReplayCount = 1;
  assert.throws(
    () => parseCrownVolumeQaConfig(noReplay),
    /deterministicReplayCount.*integer/,
  );

  const overflowing = cloneConfig('config/crown-volume-qa.yaml');
  overflowing.run.seedStart = 0xffffffff;
  overflowing.run.seedCount = 2;
  assert.throws(
    () => parseCrownVolumeQaConfig(overflowing),
    /seed range.*unsigned 32-bit/,
  );
});

test('crown volume QA rejects coercible and reversed thresholds', () => {
  const coercible = cloneConfig('config/crown-volume-qa.yaml');
  coercible.thresholds.minimumUniqueHashRate = '1';
  assert.throws(
    () => parseCrownVolumeQaConfig(coercible),
    /minimumUniqueHashRate.*finite number/,
  );

  const reversed = cloneConfig('config/crown-volume-qa.yaml');
  reversed.thresholds.ranges.triangleCount = [50000, 1000];
  assert.throws(
    () => parseCrownVolumeQaConfig(reversed),
    /triangleCount.*maximum must be >= minimum/,
  );
});

test('tree shape QA rejects malformed analysis and threshold shapes', () => {
  const badResolution = cloneConfig('config/tree-shape-qa.yaml');
  badResolution.analysis.silhouetteResolution = 1;
  assert.throws(
    () => parseTreeShapeQaConfig(badResolution),
    /silhouetteResolution.*integer/,
  );

  const badBands = cloneConfig('config/tree-shape-qa.yaml');
  badBands.thresholds.profiles.round.minimumVerticalBandCounts = [1, 2];
  assert.throws(
    () => parseTreeShapeQaConfig(badBands),
    /minimumVerticalBandCounts.*exactly 3/,
  );

  const reversed = cloneConfig('config/tree-shape-qa.yaml');
  reversed.thresholds.common.ranges.maximumBranchInsertion = [1.2, 0.5];
  assert.throws(
    () => parseTreeShapeQaConfig(reversed),
    /maximumBranchInsertion.*maximum must be >= minimum/,
  );
});

test('tree shape QA rejects stale profile policy', () => {
  const missing = cloneConfig('config/tree-shape-qa.yaml');
  delete missing.thresholds.profiles.round;
  assert.throws(
    () => parseTreeShapeQaConfig(missing),
    /profiles\.round.*object/,
  );

  const extra = cloneConfig('config/tree-shape-qa.yaml');
  extra.thresholds.profiles.retired = structuredClone(
    extra.thresholds.profiles.round,
  );
  assert.throws(
    () => parseTreeShapeQaConfig(extra),
    /unknown profile 'retired'/,
  );
});
