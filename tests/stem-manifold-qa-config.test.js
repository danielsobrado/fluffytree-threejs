import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { load } from 'js-yaml';
import { parseStemManifoldQaConfig } from '../src/qa/stem-manifold-qa-config.js';

function loadConfig() {
  return load(fs.readFileSync('config/stem-manifold-qa.yaml', 'utf8'));
}

function mutate(mutator) {
  const config = structuredClone(loadConfig());
  mutator(config);
  return config;
}

test('shipped stem manifold QA configuration is valid', () => {
  assert.doesNotThrow(() => parseStemManifoldQaConfig(loadConfig()));
});

test('stem manifold QA rejects coercible and overflowing seeds', () => {
  const coercible = mutate((config) => {
    config.run.seedStart = '1';
  });
  assert.throws(
    () => parseStemManifoldQaConfig(coercible),
    /seedStart.*integer/,
  );

  const overflowing = mutate((config) => {
    config.run.seedStart = 0xffffffff;
    config.run.seedCount = 2;
  });
  assert.throws(
    () => parseStemManifoldQaConfig(overflowing),
    /seed range.*unsigned 32-bit/,
  );
});

test('stem manifold QA rejects duplicate variant ids', () => {
  const config = mutate((value) => {
    value.run.variants[1].id = value.run.variants[0].id;
  });

  assert.throws(
    () => parseStemManifoldQaConfig(config),
    /duplicate id/,
  );
});

test('stem manifold QA rejects unsafe analysis and report values', () => {
  const negativeVolume = mutate((config) => {
    config.analysis.minimumSignedVolume = -1;
  });
  assert.throws(
    () => parseStemManifoldQaConfig(negativeVolume),
    /minimumSignedVolume.*finite number/,
  );

  const coercibleLimit = mutate((config) => {
    config.report.maximumFailureExamples = '24';
  });
  assert.throws(
    () => parseStemManifoldQaConfig(coercibleLimit),
    /maximumFailureExamples.*integer/,
  );
});
