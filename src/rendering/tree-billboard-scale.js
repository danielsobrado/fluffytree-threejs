function requireFiniteScale(scale, label) {
  if (
    !scale ||
    !Number.isFinite(scale.x) ||
    !Number.isFinite(scale.y) ||
    !Number.isFinite(scale.z)
  ) {
    throw new TypeError(`${label} must contain finite x, y, and z values.`);
  }
  return scale;
}

export function calculateTreeBillboardWorldSize(spriteScale, treeWorldScale) {
  requireFiniteScale(spriteScale, 'Billboard sprite scale');
  requireFiniteScale(treeWorldScale, 'Tree world scale');

  return Object.freeze({
    x:
      Math.abs(spriteScale.x) *
      Math.max(Math.abs(treeWorldScale.x), Math.abs(treeWorldScale.z)),
    y: Math.abs(spriteScale.y) * Math.abs(treeWorldScale.y),
  });
}
