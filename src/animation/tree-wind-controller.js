const DEFAULT_STRENGTH = 0.008;
const DEFAULT_SPEED = 0.55;

export class TreeWindController {
  constructor({ strength = DEFAULT_STRENGTH, speed = DEFAULT_SPEED } = {}) {
    this.strength = strength;
    this.speed = speed;
    this.entries = [];
  }

  register(tree, seed) {
    this.entries.push({
      tree,
      phase: ((Number(seed) % 997) / 997) * Math.PI * 2,
      baseRotationX: tree.rotation.x,
      baseRotationZ: tree.rotation.z,
    });
  }

  update(elapsedSeconds) {
    for (const entry of this.entries) {
      const wave = Math.sin(elapsedSeconds * this.speed + entry.phase);
      const secondary = Math.sin(elapsedSeconds * this.speed * 0.63 + entry.phase * 1.7);
      entry.tree.rotation.z = entry.baseRotationZ + wave * this.strength;
      entry.tree.rotation.x = entry.baseRotationX + secondary * this.strength * 0.42;
    }
  }

  clear() {
    this.entries.length = 0;
  }
}
