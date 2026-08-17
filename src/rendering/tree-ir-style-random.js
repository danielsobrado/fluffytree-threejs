import { hashCanonicalValue } from '../core/canonical-value-hash.js';

export function treeIrStyleUnit(treeIr, id, channel) {
  const hash = hashCanonicalValue([treeIr.seed, id, channel]);
  return (Number.parseInt(hash.slice(0, 8), 16) >>> 0) / 0x100000000;
}

export function treeIrStyleSigned(treeIr, id, channel) {
  return treeIrStyleUnit(treeIr, id, channel) * 2 - 1;
}
