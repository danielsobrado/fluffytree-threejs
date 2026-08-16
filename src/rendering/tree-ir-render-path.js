function midpoint(left, right) {
  return {
    x: (left.x + right.x) * 0.5,
    y: (left.y + right.y) * 0.5,
    z: (left.z + right.z) * 0.5,
  };
}

export function createRenderableTreeIrStemPath(path) {
  if (!Array.isArray(path) || path.length < 2) {
    throw new Error('A renderable Tree IR stem path requires at least two points.');
  }
  if (path.length >= 3) return path;
  return [path[0], midpoint(path[0], path[1]), path[1]];
}
