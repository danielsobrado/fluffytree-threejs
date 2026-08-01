import assert from 'node:assert/strict';
import test from 'node:test';
import { LobeConnectivityEnforcer } from '../src/generation/lobe-connectivity-enforcer.js';
import { lobeOverlapRatio } from '../src/generation/lobe-geometry.js';

function createLobe(id, x) {
  return {
    id,
    position: { x, y: 2, z: 0 },
    scale: { x: 1, y: 1, z: 1 },
    rotation: { x: 0, y: 0, z: 0 },
    colorMix: 0.5,
  };
}

test('connectivity enforcement joins detached foliage without mutating input', () => {
  const source = [createLobe(0, 0), createLobe(1, 4)];
  const result = new LobeConnectivityEnforcer().enforce(source);

  assert.ok(lobeOverlapRatio(result[0], result[1]) <= 1);
  assert.equal(source[1].position.x, 4);
});
