function freezeVector(vector) {
  return Object.freeze({
    x: vector.x,
    y: vector.y,
    z: vector.z,
  });
}

export function createCrownSummary(lobes) {
  if (!Array.isArray(lobes) || lobes.length === 0) {
    throw new Error('A crown summary requires at least one foliage lobe.');
  }

  const total = lobes.reduce(
    (result, lobe) => ({
      x: result.x + lobe.position.x,
      y: result.y + lobe.position.y,
      z: result.z + lobe.position.z,
    }),
    { x: 0, y: 0, z: 0 },
  );
  const center = {
    x: total.x / lobes.length,
    y: total.y / lobes.length,
    z: total.z / lobes.length,
  };
  // Where the foliage starts, which is where the wind stops ramping and the
  // crown starts travelling as one.
  const base = lobes.reduce(
    (lowest, lobe) => Math.min(lowest, lobe.position.y - lobe.scale.y),
    Number.POSITIVE_INFINITY,
  );

  return Object.freeze({
    center: freezeVector(center),
    base,
  });
}
