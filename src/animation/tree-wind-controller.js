import {
  TREE_WIND_PROFILE,
  calculateTreeWindBoundsPadding,
} from './tree-wind-profile.js';

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

function expandWindBounds(object, strength) {
  if (!object?.isInstancedMesh) return;

  const targetPadding = calculateTreeWindBoundsPadding(strength);
  const userData = object.userData ?? (object.userData = {});
  const previousPadding = Number(userData.windBoundsPadding ?? 0);
  const additionalPadding = targetPadding - previousPadding;
  if (!(additionalPadding > Number.EPSILON)) return;

  if (!object.boundingBox) object.computeBoundingBox?.();
  if (!object.boundingSphere) object.computeBoundingSphere?.();
  object.boundingBox?.expandByScalar?.(additionalPadding);
  if (object.boundingSphere) object.boundingSphere.radius += additionalPadding;
  userData.windBoundsPadding = targetPadding;
}

export class TreeWindController {
  constructor({
    strength = TREE_WIND_PROFILE.defaultStrength,
    speed = TREE_WIND_PROFILE.defaultSpeed,
  } = {}) {
    this.strength = requireNonNegativeFinite(strength, 'Tree wind strength');
    this.speed = requireNonNegativeFinite(speed, 'Tree wind speed');
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
        state.phase = phase;
        state.strength = this.strength;
        state.treeHeight = treeHeight;
        if (this.stateSet.has(state)) continue;

        this.stateSet.add(state);
        this.states.push(state);
      }

      if (windEnabled) expandWindBounds(object, this.strength);
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
    for (const state of this.states) state.time = elapsedSeconds * this.speed;
  }

  clear() {
    this.states.length = 0;
    this.stateSet.clear();
  }
}
