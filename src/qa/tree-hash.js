import { createHash } from 'node:crypto';

export function hashTree(tree) {
  return createHash('sha256').update(JSON.stringify(tree)).digest('hex');
}
