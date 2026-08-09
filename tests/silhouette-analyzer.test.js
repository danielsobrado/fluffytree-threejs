import assert from 'node:assert/strict';
import test from 'node:test';
import { CrownEnvelope } from '../src/generation/crown-envelope.js';
import { analyzeSilhouette } from '../src/qa/silhouette-analyzer.js';

test('silhouette coverage counts target crown outside generated foliage bounds', () => {
  const envelope = new CrownEnvelope({
    profile: 'round',
    baseHeight: 0,
    height: 2,
    radius: 2,
    lean: [0, 0],
    asymmetry: 0,
  });
  const lobes = [
    {
      position: { x: 0, y: 1, z: 0 },
      scale: { x: 0.35, y: 0.35, z: 0.35 },
      rotation: { x: 0, y: 0, z: 0 },
    },
  ];

  const result = analyzeSilhouette(lobes, envelope, 'x', 192, 32);

  assert.ok(result.targetCoverage > 0);
  assert.ok(result.targetCoverage < 0.1, result.targetCoverage);
});
