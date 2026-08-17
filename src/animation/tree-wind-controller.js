import { expandTreeWindBounds } from './tree-wind-bounds.js';
import { TREE_WIND_PROFILE } from './tree-wind-profile.js';

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

export class TreeWindController {
  constructor({
    strength = TREE_WIND_PROFILE.defaultStrength,
    speed = TREE_WIND_PROFILE.defaultSpeed,
  } = {}) {
    this.strength = requireNonNegativeFinite(strength, 'Tree wind strength');
    this.speed = requireNonNegativeFinite(speed, 'Tree wind speed');
    this.time = 0;
    this.states = [];
    this.stateSet = new Set();
    this.wrappedTrees = new WeakSet();
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
        if (this.stateSet.has(state)) continue;

        this.stateSet.add(state);
        this.states.push(state);
      }

      if (windEnabled) expandTreeWindBounds(object, this.strength);
    });

    const lodState = tree.userData?.lod;
    if (
      !lodState?.buildHero ||
      Number(lodState.minimumLevel ?? 0) > 0 ||
      this.wrappedTrees.has(tree)
    ) {
      return;
    }

    const buildHero = lodState.buildHero;
    lodState.buildHero = () => {
      const result = buildHero();
      this.register(tree, seed);
      return result;
    };
    this.wrappedTrees.add(tree);
  }

  update(elapsedSeconds) {
    this.time =
      requireNonNegativeFinite(elapsedSeconds, 'Tree wind elapsed time') *
      this.speed;
    for (const state of this.states) state.time = this.time;
  }

  clear() {
    this.time = 0;
    this.states.length = 0;
    this.stateSet.clear();
  }
}
