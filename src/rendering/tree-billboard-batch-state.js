const VISIBLE_FADE_THRESHOLD = 0.001;

function requireCapacity(capacity) {
  if (!Number.isSafeInteger(capacity) || capacity <= 0) {
    throw new RangeError('Billboard batch capacity must be a positive integer.');
  }
  return capacity;
}

function requireFade(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new RangeError('Billboard fade must be a finite number.');
  }
  return value;
}

export class TreeBillboardBatchState {
  constructor(capacity) {
    this.capacity = requireCapacity(capacity);
    this.entries = [];
    this.fades = new Float32Array(this.capacity);
    this.inverted = new Uint8Array(this.capacity);
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
    if (typeof invert !== 'boolean') {
      throw new TypeError('Billboard fade inversion must be a boolean.');
    }

    const fade = Math.fround(Math.min(1, Math.max(0, requireFade(value))));
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
