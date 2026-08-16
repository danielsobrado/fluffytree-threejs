import assert from 'node:assert/strict';
import test from 'node:test';
import { FoliagePrimitiveCompiler } from '../src/compilation/foliage-primitive-compiler.js';
import { PresetLibrary } from '../src/domain/preset-library.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

test('native broadleaf does not claim legacy shell coverage certification', () => {
  const config = readYamlConfigSync(
    new URL('../config/advanced-broadleaf-presets.yaml', import.meta.url),
  );
  const preset = PresetLibrary.fromConfig(config).get('spreadingOak');
  const ir = new TreeGenerator().generateIr(preset, 481);
  const plan = new FoliagePrimitiveCompiler().compile(ir, 'hero')[0];

  assert.equal(plan.family, 'broadleaf');
  assert.equal(plan.coveragePolicy, 'family-density');
});

test('legacy certified broadleaf keeps certified coverage policy', () => {
  const ir = new TreeGenerator().generateIr(createTestPreset(), 482);
  const plan = new FoliagePrimitiveCompiler().compile(ir, 'hero')[0];

  assert.equal(plan.coveragePolicy, 'certified');
});
