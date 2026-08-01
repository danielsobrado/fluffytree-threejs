import assert from 'node:assert/strict';
import test from 'node:test';
import { CrownEnvelope } from '../src/generation/crown-envelope.js';

function crown(profile) {
  return {
    profile,
    baseHeight: 2,
    height: 5,
    radius: 3,
    asymmetry: 0.2,
    lean: [0.25, -0.1],
  };
}

test('round crown is widest near the middle', () => {
  const envelope = new CrownEnvelope(crown('round'));
  assert.ok(envelope.radiusAt(0.5) > envelope.radiusAt(0.1));
  assert.ok(envelope.radiusAt(0.5) > envelope.radiusAt(0.9));
});

test('columnar crown keeps useful width through most of its height', () => {
  const envelope = new CrownEnvelope(crown('columnar'));
  assert.ok(envelope.radiusAt(0.25) > 2.4);
  assert.ok(envelope.radiusAt(0.75) > 2.4);
});

test('vase crown is wider in the upper half', () => {
  const envelope = new CrownEnvelope(crown('vase'));
  assert.ok(envelope.radiusAt(0.7) > envelope.radiusAt(0.3));
});

test('envelope center follows configured lean', () => {
  const envelope = new CrownEnvelope(crown('round'));
  const base = envelope.centerAt(0);
  const top = envelope.centerAt(1);
  assert.ok(top.x > base.x);
  assert.ok(top.z < base.z);
});
