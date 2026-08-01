function normalizeSeed(seed) {
  const numericSeed = Number(seed);

  if (!Number.isFinite(numericSeed)) {
    throw new Error(`Invalid random seed '${seed}'.`);
  }

  return numericSeed >>> 0;
}

export class SeededRandom {
  #state;

  constructor(seed) {
    this.#state = normalizeSeed(seed) || 0x6d2b79f5;
  }

  next() {
    let value = (this.#state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + (max - min) * this.next();
  }

  integer(min, maxInclusive) {
    return Math.floor(this.range(min, maxInclusive + 1));
  }

  signed() {
    return this.next() * 2 - 1;
  }
}
