import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateHeroClusterTilt } from '../src/rendering/hero-leaf-style.js';

test('hero leaf cluster tilt is deterministic and bounded', () => {
  const first = calculateHeroClusterTilt(77, 11, 0, 0.24);
  const second = calculateHeroClusterTilt(77, 11, 0, 0.24);
  const layered = calculateHeroClusterTilt(77, 11, 1, 0.24);

  assert.deepEqual(first, second);
  assert.ok(Math.abs(first.x) <= 0.24);
  assert.ok(Math.abs(first.z) <= 0.24);
  assert.notDeepEqual(first, layered);
  assert.deepEqual(calculateHeroClusterTilt(1, 1, 0, 0), { x: 0, z: 0 });
});
