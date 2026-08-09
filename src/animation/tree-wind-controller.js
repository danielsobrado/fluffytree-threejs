// Displacement in world units at the crown edge. Neighbouring clusters differ in
// phase by only a fraction of a radian, so this moves the canopy as a mass rather
// than sliding cards apart and opening gaps between them.
const DEFAULT_STRENGTH = 0.09;
const DEFAULT_SPEED = 0.72;

export class TreeWindController {
  constructor({ strength = DEFAULT_STRENGTH, speed = DEFAULT_SPEED } = {}) {
    this.strength = strength;
    this.speed = speed;
    this.states = [];
    this.stateSet = new Set();
    this.wrappedTrees = new WeakSet();
  }

  register(tree, seed) {
    const phase = ((Number(seed) % 997) / 997) * Math.PI * 2;
    tree.traverse((object) => {
      const materials = Array.isArray(object.material)
        ? object.material
        : object.material
          ? [object.material]
          : [];
      for (const material of materials) {
        const state = material.userData.windState;
        if (!state || this.stateSet.has(state)) continue;
        state.phase = phase;
        state.strength = this.strength;
        this.stateSet.add(state);
        this.states.push(state);
      }
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
    this.wrappedTrees = new WeakSet();
  }
}
