/**
 * Maps a seed, an element id, and a salt onto the unit interval. Every stochastic
 * rendering decision that has to survive a rebuild uses this rather than a random
 * stream, so the same seed always selects the same instances.
 */
export function hashUnit(seed, id, salt) {
  let value = (Number(seed) ^ Math.imul(id + 1, salt)) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967296;
}
