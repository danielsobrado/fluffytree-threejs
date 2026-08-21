import { expandTreeWindBounds } from './tree-wind-bounds.js?v=2.0.0-20260814.2';
import { TREE_WIND_PROFILE } from './tree-wind-profile.js?v=2.0.0-20260814.2';

function requireNonNegativeFinite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError(`${name} must be finite and non-negative.`);
  }
  return number;
}

function requirePositiveFinite(value, name) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${name} must be finite and positive.`);
  }
  return number;
}

/**
 * Whether the canopy should stand still.
 *
 * Two frames of a moving canopy are never the same image, so any comparison of
 * one build against another measures the wind rather than the change.
 * `?wind=off` freezes the crowns at the pose they were generated in.
 */
export function isWindDisabled(search) {
  const query =
    search ??
    (typeof window === 'undefined' ? '' : window.location?.search ?? '');
  const value = new URLSearchParams(query).get('wind');
  return value === 'off' || value === '0' || value === 'false';
}

export class TreeWindController {
  constructor({
    strength = TREE_WIND_PROFILE.defaultStrength,
    speed = TREE_WIND_PROFILE.defaultSpeed,
    enabled = true,
  } = {}) {
    this.enabled = enabled !== false;
    this.strength = this.enabled
      ? requireNonNegativeFinite(strength, 'Tree wind strength')
      : 0;
    this.speed = requireNonNegativeFinite(speed, 'Tree wind speed');
    this.time = 0;
    this.states = [];
    this.stateSet = new Set();
    this.stateRefCounts = new Map();
    this.treeStates = new Map();
    this.heroWrappers = new Map();
  }

  addStateReference(state) {
    const count = this.stateRefCounts.get(state) ?? 0;
    this.stateRefCounts.set(state, count + 1);
    if (count > 0) return;
    this.stateSet.add(state);
    this.states.push(state);
  }

  removeStateReference(state) {
    const count = this.stateRefCounts.get(state);
    if (!count) return;
    if (count > 1) {
      this.stateRefCounts.set(state, count - 1);
      return;
    }
    this.stateRefCounts.delete(state);
    this.stateSet.delete(state);
    const index = this.states.indexOf(state);
    if (index >= 0) this.states.splice(index, 1);
  }

  reconcileTreeStates(tree, nextStates) {
    const previousStates = this.treeStates.get(tree) ?? new Set();
    for (const state of nextStates) {
      if (!previousStates.has(state)) this.addStateReference(state);
    }
    for (const state of previousStates) {
      if (!nextStates.has(state)) this.removeStateReference(state);
    }
    this.treeStates.set(tree, nextStates);
  }

  wrapDeferredHero(tree, seed) {
    const lodState = tree.userData?.lod;
    if (
      !lodState?.buildHero ||
      Number(lodState.minimumLevel ?? 0) > 0 ||
      this.heroWrappers.has(tree)
    ) {
      return;
    }

    const original = lodState.buildHero;
    const wrapper = () => {
      const result = original();
      this.register(tree, seed);
      return result;
    };
    lodState.buildHero = wrapper;
    this.heroWrappers.set(tree, { lodState, original, wrapper });
  }

  register(tree, seed) {
    const treeHeight = requirePositiveFinite(
      tree.userData?.tree?.height,
      'Tree wind height',
    );
    const normalizedSeed = Number(seed) >>> 0;
    const phase =
      ((normalizedSeed % TREE_WIND_PROFILE.seedModulo) /
        TREE_WIND_PROFILE.seedModulo) *
      Math.PI * 2;
    const nextStates = new Set();

    tree.traverse((object) => {
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      let windEnabled = false;

      for (const material of materials) {
        const state = material?.userData?.windState;
        if (!state) continue;
        windEnabled = true;
        state.time = this.time;
        state.phase = phase;
        state.strength = this.strength;
        state.treeHeight = treeHeight;
        nextStates.add(state);
      }

      if (windEnabled) expandTreeWindBounds(object, this.strength);
    });

    this.reconcileTreeStates(tree, nextStates);
    this.wrapDeferredHero(tree, seed);
    return true;
  }

  unregister(tree) {
    const states = this.treeStates.get(tree);
    const wrapper = this.heroWrappers.get(tree);
    if (!states && !wrapper) return false;

    if (states) {
      for (const state of states) this.removeStateReference(state);
      this.treeStates.delete(tree);
    }
    if (wrapper) {
      if (wrapper.lodState.buildHero === wrapper.wrapper) {
        wrapper.lodState.buildHero = wrapper.original;
      }
      this.heroWrappers.delete(tree);
    }
    return true;
  }

  update(elapsedSeconds) {
    this.time = this.enabled
      ? requireNonNegativeFinite(elapsedSeconds, 'Tree wind elapsed time') *
        this.speed
      : 0;
    for (const state of this.states) state.time = this.time;
  }

  clear() {
    for (const { lodState, original, wrapper } of this.heroWrappers.values()) {
      if (lodState.buildHero === wrapper) lodState.buildHero = original;
    }
    this.time = 0;
    this.states.length = 0;
    this.stateSet.clear();
    this.stateRefCounts.clear();
    this.treeStates.clear();
    this.heroWrappers.clear();
  }
}
