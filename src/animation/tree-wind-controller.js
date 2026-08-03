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
        if (!state || this.states.includes(state)) continue;
        state.phase = phase;
        state.strength = this.strength;
        this.states.push(state);
      }
    });
  }

  update(elapsedSeconds) {
    for (const state of this.states) state.time = elapsedSeconds * this.speed;
  }

  clear() {
    this.states.length = 0;
  }
}
