function edgeKey(left, right) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

/**
 * Counts edges that belong to a single triangle. A watertight surface has none;
 * every open rim, cut face, or missing cap contributes one edge per segment and
 * is therefore visible as a hole from at least one direction.
 */
export function analyzeGeometryBoundary(indices) {
  const counts = new Map();

  for (let offset = 0; offset + 2 < indices.length; offset += 3) {
    const a = indices[offset];
    const b = indices[offset + 1];
    const c = indices[offset + 2];

    for (const key of [edgeKey(a, b), edgeKey(b, c), edgeKey(c, a)]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  let boundaryEdges = 0;
  let nonManifoldEdges = 0;

  for (const count of counts.values()) {
    if (count === 1) boundaryEdges += 1;
    else if (count > 2) nonManifoldEdges += 1;
  }

  return Object.freeze({
    triangleCount: Math.floor(indices.length / 3),
    edgeCount: counts.size,
    boundaryEdges,
    nonManifoldEdges,
    closed: boundaryEdges === 0 && nonManifoldEdges === 0,
  });
}

/**
 * Six times the signed volume enclosed by the triangles. A closed surface wound
 * so that its front faces point outwards is positive; an inside-out surface is
 * negative. Backface culling hides that difference on a convex tube, so nothing
 * on screen reports it until a rim or cap exposes the interior.
 */
export function calculateSignedVolume(positions, indices) {
  let total = 0;

  for (let offset = 0; offset + 2 < indices.length; offset += 3) {
    const a = indices[offset] * 3;
    const b = indices[offset + 1] * 3;
    const c = indices[offset + 2] * 3;
    const crossX =
      positions[b + 1] * positions[c + 2] - positions[b + 2] * positions[c + 1];
    const crossY =
      positions[b + 2] * positions[c] - positions[b] * positions[c + 2];
    const crossZ =
      positions[b] * positions[c + 1] - positions[b + 1] * positions[c];
    total +=
      positions[a] * crossX +
      positions[a + 1] * crossY +
      positions[a + 2] * crossZ;
  }

  return total / 6;
}
