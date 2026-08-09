import { calculateCrownEnvelopeBounds } from '../generation/crown-envelope.js';
import {
  lobeAxisAlignedExtents,
  normalizedRotatedPointDistance,
} from '../generation/lobe-geometry.js';

const ENVELOPE_RADIUS_MARGIN = 1.2;

function pointInsideLobe(point, lobe) {
  return normalizedRotatedPointDistance(point, lobe) <= 1;
}

function calculateBounds(lobes, envelope) {
  const envelopeBounds = calculateCrownEnvelopeBounds(
    envelope,
    ENVELOPE_RADIUS_MARGIN,
  );
  const extents = lobes.map((lobe) => ({
    lobe,
    extent: lobeAxisAlignedExtents(lobe),
  }));

  return {
    minimum: {
      x: Math.min(
        envelopeBounds.minimum.x,
        ...extents.map(({ lobe, extent }) => lobe.position.x - extent.x),
      ),
      y: Math.min(
        envelopeBounds.minimum.y,
        ...extents.map(({ lobe, extent }) => lobe.position.y - extent.y),
      ),
      z: Math.min(
        envelopeBounds.minimum.z,
        ...extents.map(({ lobe, extent }) => lobe.position.z - extent.z),
      ),
    },
    maximum: {
      x: Math.max(
        envelopeBounds.maximum.x,
        ...extents.map(({ lobe, extent }) => lobe.position.x + extent.x),
      ),
      y: Math.max(
        envelopeBounds.maximum.y,
        ...extents.map(({ lobe, extent }) => lobe.position.y + extent.y),
      ),
      z: Math.max(
        envelopeBounds.maximum.z,
        ...extents.map(({ lobe, extent }) => lobe.position.z + extent.z),
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
