import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizedPointDistance } from '../src/generation/lobe-geometry.js';
import { TreeGenerator } from '../src/generation/tree-generator.js';
import { createTestPreset } from './fixtures/tree-preset-fixture.js';

const EXPECTED_INSERTION = 0.55;

test('every generated branch terminates inside its target foliage lobe', () => {
  const preset = createTestPreset();
  const generator = new TreeGenerator();

  for (let seed = 1; seed <= 64; seed += 1) {
    const tree = generator.generate(preset, seed);

    for (const branch of tree.branches) {
      const target = tree.lobes.find(
        (lobe) => lobe.id === branch.targetLobeId,
      );
      assert.ok(target);
      assert.ok(
        Math.abs(
          normalizedPointDistance(branch.points.at(-1), target) -
            EXPECTED_INSERTION,
        ) < 1e-9,
      );
    }
  }
});
