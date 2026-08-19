import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_DEPTH_OF_FIELD,
  circleOfConfusion,
  resolveDepthOfFieldSettings,
  resolveFocusDistance,
} from '../src/rendering/depth-of-field-math.js';

const settings = resolveDepthOfFieldSettings();

test('an unconfigured scene gets the tuned lens', () => {
  assert.deepEqual(settings, { ...DEFAULT_DEPTH_OF_FIELD });
});

test('a scene can turn the lens off, and only by saying so', () => {
  assert.equal(resolveDepthOfFieldSettings({ enabled: false }).enabled, false);
  assert.equal(resolveDepthOfFieldSettings({}).enabled, true);
});

test('a falloff of zero cannot reach the shader as a division by zero', () => {
  const degenerate = resolveDepthOfFieldSettings({
    nearFalloff: 0,
    farFalloff: 0,
  });

  assert.ok(degenerate.nearFalloff > 0);
  assert.ok(degenerate.farFalloff > 0);
});

test('the sharp band around the focus takes no blur at all', () => {
  const focus = 18;

  assert.equal(circleOfConfusion(focus, focus, settings), 0);
  assert.equal(circleOfConfusion(focus + settings.focusRange, focus, settings), 0);
  assert.equal(circleOfConfusion(focus - settings.focusRange, focus, settings), 0);
});

test('the foreground melts faster than the tree line', () => {
  const focus = 18;
  const offset = settings.focusRange + 4;

  assert.ok(
    circleOfConfusion(focus - offset, focus, settings) >
      circleOfConfusion(focus + offset, focus, settings),
  );
});

test('blur saturates rather than running past a full circle of confusion', () => {
  assert.equal(circleOfConfusion(400, 18, settings), 1);
  assert.equal(circleOfConfusion(0, 18, settings), 1);
});

test('orbiting focuses on the thing being orbited', () => {
  const distance = resolveFocusDistance(
    {
      cameraPosition: { x: 0, y: 8, z: 15 },
      target: { x: 0, y: 4, z: 0 },
      walking: false,
    },
    settings,
  );

  assert.ok(Math.abs(distance - Math.sqrt(16 + 225)) < 1e-9);
});

test('a viewer pressed against a trunk does not throw the whole frame out', () => {
  const distance = resolveFocusDistance(
    {
      cameraPosition: { x: 0, y: 4, z: 0.2 },
      target: { x: 0, y: 4, z: 0 },
      walking: false,
    },
    settings,
  );

  assert.equal(distance, settings.minimumFocus);
});

test('walking rests the focus a fixed distance ahead', () => {
  const distance = resolveFocusDistance(
    {
      cameraPosition: { x: 0, y: 1.7, z: 30 },
      target: { x: 0, y: 0, z: 0 },
      walking: true,
    },
    settings,
  );

  assert.equal(distance, settings.walkFocus);
});
