const MAXIMUM_SEED = 0xffffffff;

function normalizeSeed(seed) {
  if (
    typeof seed !== 'number' ||
    !Number.isSafeInteger(seed) ||
    seed < 0 ||
    seed > MAXIMUM_SEED
  ) {
    throw new RangeError(
      `Random seed must be an unsigned 32-bit integer; received '${seed}'.`,
    );
  }

  return seed >>> 0;
}

export class SeededRandom {
  #state;

  constructor(seed) {
    this.#state = normalizeSeed(seed);
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
