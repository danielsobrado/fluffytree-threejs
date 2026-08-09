const VISIBLE_FADE_THRESHOLD = 0.001;

export class TreeBillboardBatchState {
  constructor(capacity) {
    this.capacity = capacity;
    this.entries = [];
    this.fades = new Float32Array(capacity);
    this.inverted = new Uint8Array(capacity);
    this.activeCount = 0;
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

    const fade = Math.min(1, Math.max(0, value));
    const inverted = invert ? 1 : 0;
    if (this.fades[index] === fade && this.inverted[index] === inverted) {
      return false;
    }

    const wasActive = this.fades[index] > VISIBLE_FADE_THRESHOLD;
    const isActive = fade > VISIBLE_FADE_THRESHOLD;
    if (wasActive !== isActive) this.activeCount += isActive ? 1 : -1;

    this.fades[index] = fade;
    this.inverted[index] = inverted;
    return true;
  }
}
