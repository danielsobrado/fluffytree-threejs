import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeCompilationService } from '../src/compilation/tree-compilation-service.js';
import { parseTreeQualityProfiles } from '../src/compilation/tree-quality-profile-config.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const qualityProfile = parseTreeQualityProfiles(
  readYamlConfigSync(new URL('../config/tree-quality-profiles.yaml', import.meta.url)),
).default;

test('compilation service reuses deterministic Tree IR and representation plans', () => {
  const delegate = new TreeGenerator();
  let generationCount = 0;
  const treeGenerator = {
    generateIr(preset, seed, options) {
      generationCount += 1;
      return delegate.generateIr(preset, seed, options);
    },
  };
  const service = new TreeCompilationService({ treeGenerator, qualityProfile });
  const preset = createTestPreset();
  const options = { generationOptions: { includeSurfaceSamples: false } };

  const firstIr = service.getTreeIr(preset, 55, options);
  const secondIr = service.getTreeIr(preset, 55, options);
  assert.equal(firstIr, secondIr);
  assert.equal(generationCount, 1);

  const first = service.acquireRepresentation(firstIr, 'aggregate');
  const second = service.acquireRepresentation(secondIr, 'aggregate');
  assert.equal(first.value, second.value);
  assert.equal(service.metrics.representations.hits, 1);
  first.release();
  second.release();
});

test('Tree IR cache keys include environment and generation options', () => {
  const delegate = new TreeGenerator();
  let generationCount = 0;
  const service = new TreeCompilationService({
    treeGenerator: {
      generateIr(preset, seed, options) {
        generationCount += 1;
        return delegate.generateIr(preset, seed, options);
      },
    },
    qualityProfile,
  });
  const preset = createTestPreset();

  service.getTreeIr(preset, 11, {
    generationOptions: { includeSurfaceSamples: false },
    environmentSignature: { slope: 0 },
  });
  service.getTreeIr(preset, 11, {
    generationOptions: { includeSurfaceSamples: false },
    environmentSignature: { slope: 0.2 },
  });

  assert.equal(generationCount, 2);
  assert.equal(service.metrics.treeIr.misses, 2);
});
