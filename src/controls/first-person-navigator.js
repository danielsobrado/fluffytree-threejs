import * as THREE from 'three';
import {
  clampHeight,
  clampPitch,
  clampToBounds,
  createMotionState,
  PLAYER_RADIUS,
  resolveDesiredVelocity,
  resolveHeadBob,
  resolveKeyAction,
  resolveLookAngles,
  resolveMoveIntent,
  resolveTreeCollisions,
  stepMotion,
  WALK_EYE_HEIGHT,
} from './first-person-motion.js';

/**
 * The camera you stand behind rather than orbit around.
 *
 * Two modes share one implementation because they differ only in what the view
 * direction is allowed to do: walking is pinned to eye height and stopped by
 * trunks, flying is free and only bounded by the ground and the sky.
 *
 * Mouse look needs pointer lock, which a browser only grants from a gesture, so
 * the keys work as soon as the mode is entered and the mouse joins in once the
 * view has been clicked.
 */

const MODE_SETTINGS = Object.freeze({
  walk: Object.freeze({ speed: 3.2, sprint: 2.3, response: 0.12 }),
  fly: Object.freeze({ speed: 13, sprint: 3.2, response: 0.22 }),
});

const LOOK_SENSITIVITY = 0.0022;
const MINIMUM_FLY_HEIGHT = 0.6;
const DEFAULT_CEILING = 240;
// Typing into the studio must never also walk the camera into a tree.
const TEXT_ENTRY_SELECTOR = 'input, select, textarea, [contenteditable="true"]';

export class FirstPersonNavigator {
  constructor(
    camera,
    domElement,
    {
      getColliders = () => [],
      getBoundsRadius = () => Number.POSITIVE_INFINITY,
      getCeiling = () => DEFAULT_CEILING,
      onChange = () => {},
    } = {},
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.getColliders = getColliders;
    this.getBoundsRadius = getBoundsRadius;
    this.getCeiling = getCeiling;
    this.onChange = onChange;
    this.mode = null;
    this.actions = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.euler = new THREE.Euler(0, 0, 0, 'YXZ');
    this.state = createMotionState(camera.position);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handleLockChange = this.handleLockChange.bind(this);
    this.handleBlur = this.handleBlur.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('pointerlockchange', this.handleLockChange);
    domElement.addEventListener('pointerdown', this.handlePointerDown);
  }

  get active() {
    return this.mode !== null;
  }

  get locked() {
    return document.pointerLockElement === this.domElement;
  }

  /** Takes over the camera, keeping where it stands and which way it faces. */
  enter(mode) {
    if (!MODE_SETTINGS[mode]) throw new Error(`Unknown navigation mode '${mode}'.`);

    this.mode = mode;
    this.euler.setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.yaw = this.euler.y;
    // Standing up looks at the horizon. The angle an orbit camera was looking
    // down from is not the one anyone wants once they are on the ground.
    this.pitch = mode === 'walk' ? 0 : clampPitch(this.euler.x);
    this.actions.clear();
    this.state = createMotionState({
      x: this.camera.position.x,
      y:
        mode === 'walk'
          ? WALK_EYE_HEIGHT
          : Math.max(MINIMUM_FLY_HEIGHT, this.camera.position.y),
      z: this.camera.position.z,
    });
    this.onChange(this);
  }

  exit() {
    if (!this.mode) return;

    this.mode = null;
    this.actions.clear();
    if (this.locked) document.exitPointerLock();
    this.onChange(this);
  }

  requestLock() {
    if (this.active && !this.locked) this.domElement.requestPointerLock?.();
  }

  update(delta) {
    if (!this.mode) return;

    const settings = MODE_SETTINGS[this.mode];
    const intent = resolveMoveIntent(this.actions);
    const speed = settings.speed * (intent.sprint ? settings.sprint : 1);
    const desired = resolveDesiredVelocity(intent, {
      yaw: this.yaw,
      pitch: this.pitch,
      mode: this.mode,
      speed,
    });

    this.state = stepMotion(this.state, {
      desired,
      delta,
      response: settings.response,
    });

    let position =
      this.mode === 'walk'
        ? resolveTreeCollisions(
            { ...this.state.position, y: WALK_EYE_HEIGHT },
            this.getColliders(),
            PLAYER_RADIUS,
          )
        : clampHeight(this.state.position, MINIMUM_FLY_HEIGHT, this.getCeiling());
    position = clampToBounds(position, this.getBoundsRadius());
    this.state.position = position;

    const planarSpeed = Math.hypot(this.state.velocity.x, this.state.velocity.z);
    const bob =
      this.mode === 'walk'
        ? resolveHeadBob(this.state.travelled, planarSpeed / settings.speed)
        : 0;

    this.camera.position.set(position.x, position.y + bob, position.z);
    this.euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this.euler);
  }

  handleKeyDown(event) {
    if (!this.active || event.repeat) return;
    if (
      event.target instanceof HTMLElement &&
      event.target.closest(TEXT_ENTRY_SELECTOR)
    ) {
      return;
    }

    const action = resolveKeyAction(event.code);
    if (!action) return;

    this.actions.add(action);
    event.preventDefault();
  }

  handleKeyUp(event) {
    const action = resolveKeyAction(event.code);
    if (action) this.actions.delete(action);
  }

  handleMouseMove(event) {
    if (!this.active || !this.locked) return;

    const angles = resolveLookAngles(
      { yaw: this.yaw, pitch: this.pitch },
      { x: event.movementX ?? 0, y: event.movementY ?? 0 },
      LOOK_SENSITIVITY,
    );
    this.yaw = angles.yaw;
    this.pitch = angles.pitch;
  }

  handlePointerDown() {
    this.requestLock();
  }

  handleLockChange() {
    // Releasing the pointer releases the keys with it, or a key held while the
    // lock broke would walk the camera away on its own.
    if (!this.locked) this.actions.clear();
    this.onChange(this);
  }

  handleBlur() {
    this.actions.clear();
  }

  dispose() {
    this.exit();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('pointerlockchange', this.handleLockChange);
    this.domElement.removeEventListener('pointerdown', this.handlePointerDown);
  }
}
