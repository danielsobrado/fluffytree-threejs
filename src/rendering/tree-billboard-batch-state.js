export class TreeBillboardBatchState {
  constructor(capacity) {
    this.capacity = capacity;
    this.entries = [];
    this.fades = new Float32Array(capacity);
    this.inverted = new Uint8Array(capacity);
  }

  add(entry) {
    if (this.entries.length >= this.capacity) {
      throw new Error(`Billboard batch exceeded ${this.capacity} trees.`);
    }
    const index = this.entries.length;
    this.entries.push(entry);
    return index;
  }

  setFade(index, value, invert = false) {
    if (index < 0 || index >= this.entries.length) {
      throw new RangeError(`Unknown billboard instance ${index}.`);
    }
    this.fades[index] = Math.min(1, Math.max(0, value));
    this.inverted[index] = invert ? 1 : 0;
  }
}
