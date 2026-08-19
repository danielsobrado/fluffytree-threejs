import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampHeight,
  clampPitch,
  clampToBounds,
  createMotionState,
  PITCH_LIMIT,
  resolveDesiredVelocity,
  resolveHeadBob,
  resolveKeyAction,
  resolveLookAngles,
  resolveMoveIntent,
  resolveTreeCollisions,
  stepMotion,
} from '../src/controls/first-person-motion.js';

function intentFrom(...actions) {
  return resolveMoveIntent(new Set(actions));
}

test('a diagonal is not faster than a straight run', () => {
  const straight = intentFrom('forward');
  const diagonal = intentFrom('forward', 'right');

  assert.equal(Math.hypot(straight.forward, straight.strafe), 1);
  assert.ok(Math.abs(Math.hypot(diagonal.forward, diagonal.strafe) - 1) < 1e-12);
});

test('opposed keys cancel and unbound keys do nothing', () => {
  const stopped = intentFrom('forward', 'back', 'left', 'right');

  assert.deepEqual(
    { forward: stopped.forward, strafe: stopped.strafe, lift: stopped.lift },
    { forward: 0, strafe: 0, lift: 0 },
  );
  assert.equal(resolveKeyAction('KeyW'), 'forward');
  assert.equal(resolveKeyAction('ShiftLeft'), 'sprint');
  assert.equal(resolveKeyAction('KeyZ'), null);
});

test('walking follows the yaw and ignores the pitch', () => {
  const level = resolveDesiredVelocity(intentFrom('forward'), {
    yaw: 0,
    pitch: 0,
    mode: 'walk',
    speed: 3,
  });
  const lookingUp = resolveDesiredVelocity(intentFrom('forward'), {
    yaw: 0,
    pitch: 1.2,
    mode: 'walk',
    speed: 3,
  });

  // Yaw zero looks down -Z, the direction a Three.js camera faces.
  assert.ok(Math.abs(level.x) < 1e-12);
  assert.ok(Math.abs(level.z + 3) < 1e-12);
  assert.equal(level.y, 0);
  assert.deepEqual(lookingUp, level);
});

test('a quarter turn to the left walks towards -X', () => {
  const velocity = resolveDesiredVelocity(intentFrom('forward'), {
    yaw: Math.PI / 2,
    mode: 'walk',
    speed: 2,
  });

  assert.ok(Math.abs(velocity.x + 2) < 1e-12);
  assert.ok(Math.abs(velocity.z) < 1e-12);
});

test('flying goes where the view points', () => {
  const velocity = resolveDesiredVelocity(intentFrom('forward'), {
    yaw: 0,
    pitch: Math.PI / 2,
    mode: 'fly',
    speed: 4,
  });

  assert.ok(Math.abs(velocity.y - 4) < 1e-12);
  assert.ok(Math.abs(velocity.z) < 1e-9);
});

test('flying rises and falls without looking up', () => {
  const rising = resolveDesiredVelocity(intentFrom('up'), { yaw: 0, mode: 'fly', speed: 5 });
  const falling = resolveDesiredVelocity(intentFrom('down'), { yaw: 0, mode: 'fly', speed: 5 });

  assert.equal(rising.y, 5);
  assert.equal(falling.y, -5);
});

test('speed builds towards the intent and settles back to nothing', () => {
  const desired = { x: 3, y: 0, z: 0 };
  let state = createMotionState({ x: 0, y: 1.62, z: 0 });

  for (let frame = 0; frame < 120; frame += 1) {
    state = stepMotion(state, { desired, delta: 1 / 60, response: 0.12 });
  }

  assert.ok(Math.abs(state.velocity.x - 3) < 0.01);
  assert.ok(state.position.x > 5);
  assert.ok(Math.abs(state.travelled - state.position.x) < 0.05);

  const before = state.velocity.x;
  for (let frame = 0; frame < 120; frame += 1) {
    state = stepMotion(state, {
      desired: { x: 0, y: 0, z: 0 },
      delta: 1 / 60,
      response: 0.12,
    });
  }

  assert.ok(state.velocity.x < before * 0.01);
});

test('a second of movement covers the same ground at any frame rate', () => {
  const desired = { x: 4, y: 0, z: 0 };
  const run = (steps) => {
    let state = createMotionState({ x: 0, y: 0, z: 0 });
    for (let frame = 0; frame < steps; frame += 1) {
      state = stepMotion(state, { desired, delta: 1 / steps, response: 0.15 });
    }
    return state.position.x;
  };

  // Fifteen frames a second is what the forest drops to while it grows, and a
  // walk there has to cover the same ground as a walk at sixty. Integrating
  // velocity in steps leaves a little behind; three per cent of a second's
  // travel is not something a hand on a key can feel.
  const smooth = run(60);
  assert.ok(Math.abs(run(15) - smooth) < smooth * 0.03);
  assert.ok(Math.abs(run(240) - smooth) < smooth * 0.03);
});

test('a trunk pushes the walker out and lets them slide around it', () => {
  const colliders = [{ x: 0, z: 0, radius: 0.6 }];
  const inside = resolveTreeCollisions({ x: 0.1, y: 1.62, z: 0 }, colliders, 0.4);

  assert.ok(Math.abs(Math.hypot(inside.x, inside.z) - 1) < 1e-12);
  assert.equal(inside.y, 1.62);
  assert.equal(inside.z, 0);

  const centred = resolveTreeCollisions({ x: 0, y: 1.62, z: 0 }, colliders, 0.4);
  assert.ok(Math.hypot(centred.x, centred.z) >= 1);

  const clear = { x: 8, y: 1.62, z: 8 };
  assert.deepEqual(resolveTreeCollisions(clear, colliders, 0.4), clear);
});

test('the ground disc is the edge of the world', () => {
  const clamped = clampToBounds({ x: 30, y: 1.62, z: 40 }, 25);

  assert.ok(Math.abs(Math.hypot(clamped.x, clamped.z) - 25) < 1e-12);
  assert.deepEqual(clampToBounds({ x: 1, y: 0, z: 1 }, 25), { x: 1, y: 0, z: 1 });
  assert.deepEqual(clampHeight({ x: 0, y: -4, z: 0 }, 0.6, 100).y, 0.6);
  assert.deepEqual(clampHeight({ x: 0, y: 900, z: 0 }, 0.6, 100).y, 100);
});

test('looking around is bounded short of vertical', () => {
  const angles = resolveLookAngles({ yaw: 0, pitch: 0 }, { x: 100, y: -10000 }, 0.002);

  assert.equal(angles.pitch, PITCH_LIMIT);
  assert.equal(clampPitch(-99), -PITCH_LIMIT);
  assert.ok(angles.yaw < 0, 'moving the mouse right turns the view right');
});

test('the head only bobs while the walk is moving', () => {
  assert.equal(resolveHeadBob(0, 1), 0);
  assert.equal(resolveHeadBob(0.26, 0), 0);
  assert.ok(Math.abs(resolveHeadBob(0.26, 1)) > 0.01);
  assert.ok(Math.abs(resolveHeadBob(0.26, 1)) < 0.06);
});
