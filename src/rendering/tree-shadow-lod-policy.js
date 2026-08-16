import { isDetailedTreeRepresentation } from './tree-representation-role.js';

export function shouldRenderTreeShadowProxy(
  role,
  projectedPixels,
  shadowPixels,
) {
  if (!Number.isFinite(projectedPixels) || !Number.isFinite(shadowPixels)) {
    throw new TypeError('Tree shadow LOD inputs must be finite numbers.');
  }
  return projectedPixels >= shadowPixels && isDetailedTreeRepresentation(role);
}
