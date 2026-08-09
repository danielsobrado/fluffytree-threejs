import { calculateCrownEnvelopeBounds } from '../generation/crown-envelope.js';
import { correlation, mean, rootMeanSquareError } from './qa-math.js';
import { calculateHoleRatio, countComponents } from './mask-analyzer.js';
import {
  createLobeProjection,
  projectedLobeContains,
  projectedLobeRow,
} from './lobe-projection.js';

const PROJECTION_PADDING = 0.03;
const PROFILE_BANDS = Object.freeze({
  lower: [0.12, 0.33],
  middle: [0.38, 0.62],
  upper: [0.67, 0.88],
});

function createProjections(lobes, horizontalAxis) {
  return lobes.map((lobe) => createLobeProjection(lobe, horizontalAxis));
}

function getProjectionBounds(projections, envelope, horizontalAxis) {
  const envelopeBounds = calculateCrownEnvelopeBounds(envelope);
  const horizontalMinimum = Math.min(
    envelopeBounds.minimum[horizontalAxis],
    ...projections.map(
      (projection) => projection.centerX - projection.horizontalExtent,
    ),
  );
  const horizontalMaximum = Math.max(
    envelopeBounds.maximum[horizontalAxis],
    ...projections.map(
      (projection) => projection.centerX + projection.horizontalExtent,
    ),
  );
  const verticalMinimum = Math.min(
    envelopeBounds.minimum.y,
    ...projections.map(
      (projection) => projection.centerY - projection.verticalExtent,
    ),
  );
  const verticalMaximum = Math.max(
    envelopeBounds.maximum.y,
    ...projections.map(
      (projection) => projection.centerY + projection.verticalExtent,
    ),
  );
  const horizontalPadding =
    (horizontalMaximum - horizontalMinimum) * PROJECTION_PADDING;
  const verticalPadding =
    (verticalMaximum - verticalMinimum) * PROJECTION_PADDING;

  return {
    horizontalMinimum: horizontalMinimum - horizontalPadding,
    horizontalMaximum: horizontalMaximum + horizontalPadding,
    verticalMinimum: verticalMinimum - verticalPadding,
    verticalMaximum: verticalMaximum + verticalPadding,
  };
}

function toPixel(value, minimum, maximum, resolution) {
  return Math.floor(((value - minimum) / (maximum - minimum)) * resolution);
}

function rasterizeLobes(projections, bounds, resolution) {
  const mask = new Uint8Array(resolution * resolution);
  const horizontalSpan = bounds.horizontalMaximum - bounds.horizontalMinimum;
  const verticalSpan = bounds.verticalMaximum - bounds.verticalMinimum;

  for (const projection of projections) {
    const minimumX = Math.max(
      0,
      toPixel(
        projection.centerX - projection.horizontalExtent,
        bounds.horizontalMinimum,
        bounds.horizontalMaximum,
        resolution,
      ),
    );
    const maximumX = Math.min(
      resolution - 1,
      toPixel(
        projection.centerX + projection.horizontalExtent,
        bounds.horizontalMinimum,
        bounds.horizontalMaximum,
        resolution,
      ),
    );
    const minimumY = Math.max(
      0,
      toPixel(
        projection.centerY - projection.verticalExtent,
        bounds.verticalMinimum,
        bounds.verticalMaximum,
        resolution,
      ),
    );
    const maximumY = Math.min(
      resolution - 1,
      toPixel(
        projection.centerY + projection.verticalExtent,
        bounds.verticalMinimum,
        bounds.verticalMaximum,
        resolution,
      ),
    );

    for (let y = minimumY; y <= maximumY; y += 1) {
      const worldY =
        bounds.verticalMinimum + ((y + 0.5) / resolution) * verticalSpan;
      const row = projectedLobeRow(projection, worldY);
      if (!row) continue;
      const rowMinimum = Math.max(
        minimumX,
        toPixel(
          row.minimum,
          bounds.horizontalMinimum,
          bounds.horizontalMaximum,
          resolution,
        ),
      );
      const rowMaximum = Math.min(
        maximumX,
        toPixel(
          row.maximum,
          bounds.horizontalMinimum,
          bounds.horizontalMaximum,
          resolution,
        ),
      );

      for (let x = rowMinimum; x <= rowMaximum; x += 1) {
        const worldX =
          bounds.horizontalMinimum + ((x + 0.5) / resolution) * horizontalSpan;
        if (projectedLobeContains(projection, worldX, worldY)) {
          mask[y * resolution + x] = 1;
        }
      }
    }
  }

  return mask;
}

function rasterizeEnvelope(envelope, horizontalAxis, bounds, resolution) {
  const mask = new Uint8Array(resolution * resolution);
  const horizontalSpan = bounds.horizontalMaximum - bounds.horizontalMinimum;
  const verticalSpan = bounds.verticalMaximum - bounds.verticalMinimum;

  for (let y = 0; y < resolution; y += 1) {
    const worldY =
      bounds.verticalMinimum + ((y + 0.5) / resolution) * verticalSpan;
    const normalizedHeight =
      (worldY - envelope.crown.baseHeight) / envelope.crown.height;

    if (normalizedHeight < 0 || normalizedHeight > 1) continue;

    const center = envelope.centerAt(normalizedHeight);
    const radius = envelope.radiusAt(normalizedHeight);

    for (let x = 0; x < resolution; x += 1) {
      const worldX =
        bounds.horizontalMinimum + ((x + 0.5) / resolution) * horizontalSpan;

      if (Math.abs(worldX - center[horizontalAxis]) <= radius) {
        mask[y * resolution + x] = 1;
      }
    }
  }

  return mask;
}

function countMask(mask) {
  let count = 0;
  for (const value of mask) count += value;
  return count;
}

function calculateTightFillRatio(mask, resolution, occupiedCount) {
  let minimumX = resolution;
  let maximumX = -1;
  let minimumY = resolution;
  let maximumY = -1;

  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] === 0) continue;
    const x = index % resolution;
    const y = Math.floor(index / resolution);
    minimumX = Math.min(minimumX, x);
    maximumX = Math.max(maximumX, x);
    minimumY = Math.min(minimumY, y);
    maximumY = Math.max(maximumY, y);
  }

  if (maximumX < minimumX || maximumY < minimumY) return 0;
  const area = (maximumX - minimumX + 1) * (maximumY - minimumY + 1);
  return occupiedCount / area;
}

function compareMasks(lobeMask, envelopeMask) {
  let intersection = 0;
  let lobeOnly = 0;

  for (let index = 0; index < lobeMask.length; index += 1) {
    if (lobeMask[index] === 1 && envelopeMask[index] === 1) intersection += 1;
    if (lobeMask[index] === 1 && envelopeMask[index] === 0) lobeOnly += 1;
  }

  const lobeCount = countMask(lobeMask);
  const envelopeCount = countMask(envelopeMask);
  return {
    targetCoverage: envelopeCount === 0 ? 0 : intersection / envelopeCount,
    excessRatio: lobeCount === 0 ? 0 : lobeOnly / lobeCount,
  };
}

function widthAtHeight(projections, worldY) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;

  for (const projection of projections) {
    const row = projectedLobeRow(projection, worldY);
    if (!row) continue;
    minimum = Math.min(minimum, row.minimum);
    maximum = Math.max(maximum, row.maximum);
  }

  return Number.isFinite(minimum) ? maximum - minimum : 0;
}

function analyzeProfile(projections, envelope, sampleCount) {
  const observed = [];
  const expected = [];
  const bands = { lower: [], middle: [], upper: [] };

  for (let index = 0; index < sampleCount; index += 1) {
    const normalizedHeight = (index + 0.5) / sampleCount;
    const worldY =
      envelope.crown.baseHeight + normalizedHeight * envelope.crown.height;
    const width = widthAtHeight(projections, worldY);
    observed.push(width);
    expected.push(envelope.radiusAt(normalizedHeight) * 2);

    for (const [name, [minimum, maximum]] of Object.entries(PROFILE_BANDS)) {
      if (normalizedHeight >= minimum && normalizedHeight < maximum) {
        bands[name].push(width);
      }
    }
  }

  const observedMaximum = Math.max(...observed);
  const expectedMaximum = Math.max(...expected);
  const normalizedObserved = observed.map((value) =>
    observedMaximum <= Number.EPSILON ? 0 : value / observedMaximum,
  );
  const normalizedExpected = expected.map((value) =>
    expectedMaximum <= Number.EPSILON ? 0 : value / expectedMaximum,
  );
  const lower = mean(bands.lower);
  const middle = mean(bands.middle);
  const upper = mean(bands.upper);

  return {
    profileRmse: rootMeanSquareError(normalizedObserved, normalizedExpected),
    profileCorrelation: correlation(normalizedObserved, normalizedExpected),
    upperLowerWidthRatio: lower === 0 ? 0 : upper / lower,
    middleLowerWidthRatio: lower === 0 ? 0 : middle / lower,
    middleUpperWidthRatio: upper === 0 ? 0 : middle / upper,
  };
}

export function analyzeSilhouette(
  lobes,
  envelope,
  horizontalAxis,
  resolution,
  profileSampleCount,
) {
  const projections = createProjections(lobes, horizontalAxis);
  const bounds = getProjectionBounds(projections, envelope, horizontalAxis);
  const lobeMask = rasterizeLobes(projections, bounds, resolution);
  const envelopeMask = rasterizeEnvelope(
    envelope,
    horizontalAxis,
    bounds,
    resolution,
  );
  const occupiedCount = countMask(lobeMask);
  const components = countComponents(lobeMask, resolution, resolution);

  return {
    fillRatio: calculateTightFillRatio(lobeMask, resolution, occupiedCount),
    componentCount: components.count,
    largestComponentRatio:
      occupiedCount === 0 ? 0 : components.largest / occupiedCount,
    holeRatio: calculateHoleRatio(
      lobeMask,
      resolution,
      resolution,
      occupiedCount,
    ),
    ...compareMasks(lobeMask, envelopeMask),
    ...analyzeProfile(projections, envelope, profileSampleCount),
  };
}
