function pointInsideLobe(point, lobe) {
  return (
    ((point.x - lobe.position.x) / lobe.scale.x) ** 2 +
      ((point.y - lobe.position.y) / lobe.scale.y) ** 2 +
      ((point.z - lobe.position.z) / lobe.scale.z) ** 2 <=
    1
  );
}

function calculateBounds(lobes, envelope) {
  return {
    minimum: {
      x: Math.min(
        -envelope.crown.radius * 1.2,
        ...lobes.map((lobe) => lobe.position.x - lobe.scale.x),
      ),
      y: Math.min(
        envelope.crown.baseHeight,
        ...lobes.map((lobe) => lobe.position.y - lobe.scale.y),
      ),
      z: Math.min(
        -envelope.crown.radius * 1.2,
        ...lobes.map((lobe) => lobe.position.z - lobe.scale.z),
      ),
    },
    maximum: {
      x: Math.max(
        envelope.crown.radius * 1.2,
        ...lobes.map((lobe) => lobe.position.x + lobe.scale.x),
      ),
      y: Math.max(
        envelope.crown.baseHeight + envelope.crown.height,
        ...lobes.map((lobe) => lobe.position.y + lobe.scale.y),
      ),
      z: Math.max(
        envelope.crown.radius * 1.2,
        ...lobes.map((lobe) => lobe.position.z + lobe.scale.z),
      ),
    },
  };
}

export function analyzeVolume(lobes, envelope, resolution) {
  const bounds = calculateBounds(lobes, envelope);
  const span = {
    x: bounds.maximum.x - bounds.minimum.x,
    y: bounds.maximum.y - bounds.minimum.y,
    z: bounds.maximum.z - bounds.minimum.z,
  };
  let envelopeSamples = 0;
  let foliageSamples = 0;
  let intersectionSamples = 0;

  for (let xIndex = 0; xIndex < resolution; xIndex += 1) {
    const x =
      bounds.minimum.x + ((xIndex + 0.5) / resolution) * span.x;

    for (let yIndex = 0; yIndex < resolution; yIndex += 1) {
      const y =
        bounds.minimum.y + ((yIndex + 0.5) / resolution) * span.y;

      for (let zIndex = 0; zIndex < resolution; zIndex += 1) {
        const z =
          bounds.minimum.z + ((zIndex + 0.5) / resolution) * span.z;
        const point = { x, y, z };
        const insideEnvelope = envelope.contains(point);
        const insideFoliage = lobes.some((lobe) =>
          pointInsideLobe(point, lobe),
        );

        if (insideEnvelope) envelopeSamples += 1;
        if (insideFoliage) foliageSamples += 1;
        if (insideEnvelope && insideFoliage) intersectionSamples += 1;
      }
    }
  }

  return {
    envelopeCoverage:
      envelopeSamples === 0 ? 0 : intersectionSamples / envelopeSamples,
    unionSpillRatio:
      foliageSamples === 0
        ? 0
        : (foliageSamples - intersectionSamples) / foliageSamples,
  };
}
