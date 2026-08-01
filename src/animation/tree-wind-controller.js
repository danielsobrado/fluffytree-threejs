export class TreeWindController {
  constructor({ strength = 0.055, speed = 0.72 } = {}) {
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
