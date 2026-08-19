import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_CONTACT_SHADOW,
  resolveContactShadowFootprint,
  resolveContactShadowSettings,
} from '../src/rendering/contact-shadow-layout.js';

const settings = resolveContactShadowSettings();

function bounds(minimum, maximum) {
  return { minimum, maximum };
}

const upright = bounds({ x: -2, y: 0, z: -2 }, { x: 2, y: 7, z: 2 });

test('an unconfigured scene gets the tuned pool', () => {
  assert.deepEqual(settings, { ...DEFAULT_CONTACT_SHADOW });
});

test('strength cannot be pushed past a fully opaque pool', () => {
  assert.equal(resolveContactShadowSettings({ strength: 4 }).strength, 1);
  assert.equal(resolveContactShadowSettings({ strength: -1 }).strength, 0);
});

test('a pool sits under the crown and spreads a little past it', () => {
  const footprint = resolveContactShadowFootprint(
    { bounds: upright, position: [3, 0, -4], rotationY: 0, scale: 1 },
    settings,
  );

  assert.equal(footprint.x, 3);
  assert.equal(footprint.z, -4);
  assert.equal(footprint.radius, 2 * settings.radiusScale);
});

test('a leaning crown drags its pool with it, not its trunk', () => {
  const leaning = bounds({ x: 0, y: 0, z: -1 }, { x: 4, y: 6, z: 1 });
  const footprint = resolveContactShadowFootprint(
    { bounds: leaning, position: [0, 0, 0], rotationY: 0, scale: 1 },
    settings,
  );

  assert.equal(footprint.x, 2);
  assert.equal(footprint.z, 0);
});

test('rotating the tree rotates where its shade falls', () => {
  const leaning = bounds({ x: 0, y: 0, z: -1 }, { x: 4, y: 6, z: 1 });
  const footprint = resolveContactShadowFootprint(
    { bounds: leaning, position: [0, 0, 0], rotationY: Math.PI / 2, scale: 1 },
    settings,
  );

  assert.ok(Math.abs(footprint.x) < 1e-9);
  assert.ok(Math.abs(footprint.z + 2) < 1e-9);
});

test('a scaled tree scales both its offset and its pool', () => {
  const leaning = bounds({ x: 0, y: 0, z: -1 }, { x: 4, y: 6, z: 1 });
  const footprint = resolveContactShadowFootprint(
    { bounds: leaning, position: [0, 0, 0], rotationY: 0, scale: 2 },
    settings,
  );

  assert.equal(footprint.x, 4);
  assert.equal(footprint.radius, 4 * settings.radiusScale);
});

test('a sapling still gets a pool rather than a point', () => {
  const tiny = bounds({ x: -0.02, y: 0, z: -0.02 }, { x: 0.02, y: 0.4, z: 0.02 });
  const footprint = resolveContactShadowFootprint(
    { bounds: tiny, position: [0, 0, 0] },
    settings,
  );

  assert.equal(footprint.radius, settings.minimumRadius);
});
