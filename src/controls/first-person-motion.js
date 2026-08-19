/**
 * Walking and flying, as arithmetic.
 *
 * The decisions a first-person camera makes — what a key means, how speed
 * builds and settles, where a trunk stops you, how far the ground reaches —
 * are separated from the DOM and from Three.js so they can be tested without a
 * browser. The navigator owns the state; every function here takes it and
 * returns a new one rather than mutating what it was given.
 */

export const WALK_EYE_HEIGHT = 1.62;
export const PLAYER_RADIUS = 0.38;
// Just short of vertical. Looking straight up would let the yaw flip the world.
export const PITCH_LIMIT = 1.45;

const BOB_FREQUENCY = 6;
const BOB_AMPLITUDE = 0.045;

const KEY_ACTIONS = new Map([
  ['KeyW', 'forward'],
  ['ArrowUp', 'forward'],
  ['KeyS', 'back'],
  ['ArrowDown', 'back'],
  ['KeyA', 'left'],
  ['ArrowLeft', 'left'],
  ['KeyD', 'right'],
  ['ArrowRight', 'right'],
  ['Space', 'up'],
  ['KeyE', 'up'],
  ['PageUp', 'up'],
  ['KeyQ', 'down'],
  ['KeyC', 'down'],
  ['PageDown', 'down'],
  ['ShiftLeft', 'sprint'],
  ['ShiftRight', 'sprint'],
]);

export function resolveKeyAction(code) {
  return KEY_ACTIONS.get(code) ?? null;
}

export function createMotionState(position, travelled = 0) {
  return {
    position: { x: position.x, y: position.y, z: position.z },
    velocity: { x: 0, y: 0, z: 0 },
    travelled,
  };
}

export function clampPitch(pitch) {
  return Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, pitch));
}

export function resolveLookAngles(angles, movement, sensitivity) {
  return {
    yaw: angles.yaw - movement.x * sensitivity,
    pitch: clampPitch(angles.pitch - movement.y * sensitivity),
  };
}

/** Held actions become an intent; a diagonal is not faster than a straight run. */
export function resolveMoveIntent(actions) {
  const axis = (positive, negative) =>
    (actions.has(positive) ? 1 : 0) - (actions.has(negative) ? 1 : 0);
  const forward = axis('forward', 'back');
  const strafe = axis('right', 'left');
  const planar = Math.hypot(forward, strafe);
  const normalize = planar > 1 ? 1 / planar : 1;

  return {
    forward: forward * normalize,
    strafe: strafe * normalize,
    lift: axis('up', 'down'),
    sprint: actions.has('sprint'),
  };
}

/**
 * Where the intent points, in world units per second.
 *
 * Walking ignores the pitch: looking at the canopy should not lift you off the
 * ground, and looking at your feet should not drive you into it. Flying uses
 * the whole view direction, which is what makes it feel like flying rather than
 * like a walk with a height slider.
 */
export function resolveDesiredVelocity(intent, { yaw, pitch = 0, mode = 'walk', speed = 1 }) {
  const sinYaw = Math.sin(yaw);
  const cosYaw = Math.cos(yaw);
  const flying = mode === 'fly';
  const planar = flying ? Math.cos(pitch) : 1;
  const rise = flying ? Math.sin(pitch) : 0;

  return {
    x: (-sinYaw * planar * intent.forward + cosYaw * intent.strafe) * speed,
    y: flying ? (rise * intent.forward + intent.lift) * speed : 0,
    z: (-cosYaw * planar * intent.forward - sinYaw * intent.strafe) * speed,
  };
}

/**
 * Advances one frame.
 *
 * Velocity chases the intent exponentially, so the same response time produces
 * the same feel whatever the frame rate is — which matters here, because the
 * scene this drives is the one that drops frames while it grows.
 */
export function stepMotion(state, { desired, delta, response = 0.14 }) {
  const blend = response > 0 ? 1 - Math.exp(-delta / response) : 1;
  const velocity = {
    x: state.velocity.x + (desired.x - state.velocity.x) * blend,
    y: state.velocity.y + (desired.y - state.velocity.y) * blend,
    z: state.velocity.z + (desired.z - state.velocity.z) * blend,
  };

  return {
    position: {
      x: state.position.x + velocity.x * delta,
      y: state.position.y + velocity.y * delta,
      z: state.position.z + velocity.z * delta,
    },
    velocity,
    travelled: state.travelled + Math.hypot(velocity.x, velocity.z) * delta,
  };
}

/**
 * Pushes the walker back out of any trunk it stepped into.
 *
 * The push is radial and the velocity is left alone, so holding forward against
 * a trunk slides around it instead of stopping dead.
 */
export function resolveTreeCollisions(position, colliders, playerRadius = PLAYER_RADIUS) {
  let x = position.x;
  let z = position.z;

  for (const collider of colliders) {
    const dx = x - collider.x;
    const dz = z - collider.z;
    const clearance = collider.radius + playerRadius;
    const distance = Math.hypot(dx, dz);

    if (distance >= clearance) continue;

    // Dead centre has no direction to push along, so any one will do.
    if (distance < 1e-4) {
      x = collider.x + clearance;
      continue;
    }

    const push = clearance / distance;
    x = collider.x + dx * push;
    z = collider.z + dz * push;
  }

  return { ...position, x, z };
}

export function clampToBounds(position, radius) {
  const distance = Math.hypot(position.x, position.z);

  if (!Number.isFinite(radius) || distance <= radius || distance === 0) return position;

  const scale = radius / distance;
  return { ...position, x: position.x * scale, z: position.z * scale };
}

export function clampHeight(position, minimum, maximum) {
  return { ...position, y: Math.min(maximum, Math.max(minimum, position.y)) };
}

/** A small rise and fall with the stride, scaled by how fast the walk is. */
export function resolveHeadBob(travelled, speedRatio) {
  return (
    Math.sin(travelled * BOB_FREQUENCY) *
    BOB_AMPLITUDE *
    Math.min(1, Math.max(0, speedRatio))
  );
}
