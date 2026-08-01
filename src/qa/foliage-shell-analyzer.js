import {
  normalizeVector,
  normalizedRotatedPointDistance,
} from '../generation/lobe-geometry.js';
import { calculateHoleRatio, countComponents } from './mask-analyzer.js';

const PROJECTION_PADDING = 0.04;
const SHELL_HORIZONTAL_RADIUS_FACTOR = 0.58;
const SHELL_VERTICAL_RADIUS_FACTOR = 0.68;
const POSITION_KEY_PRECISION = 6;

function mean(values) {
  return values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;
}

function calculateProjectionBounds(tree, horizontalAxis) {
  const horizontalValues = [];
  const verticalValues = [];

  for (const lobe of tree.lobes) {
    horizontalValues.push(
      lobe.position[horizontalAxis] - lobe.scale[horizontalAxis],
      lobe.position[horizontalAxis] + lobe.scale[horizontalAxis],
    );
    verticalValues.push(
      lobe.position.y - lobe.scale.y,
      lobe.position.y + lobe.scale.y,
    );
  }

  for (const instance of tree.shell) {
    horizontalValues.push(
      instance.position[horizontalAxis] - instance.scale,
      instance.position[horizontalAxis] + instance.scale,
    );
    verticalValues.push(
      instance.position.y - instance.scale,
      instance.position.y + instance.scale,
    );
  }

  const horizontalMinimum = Math.min(...horizontalValues);
  const horizontalMaximum = Math.max(...horizontalValues);
  const verticalMinimum = Math.min(...verticalValues);
  const verticalMaximum = Math.max(...verticalValues);
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

function rasterizeEllipse(mask, resolution, bounds, ellipse) {
  const horizontalSpan = bounds.horizontalMaximum - bounds.horizontalMinimum;
  const verticalSpan = bounds.verticalMaximum - bounds.verticalMinimum;
  const minimumX = Math.max(
    0,
    toPixel(
      ellipse.horizontal - ellipse.horizontalRadius,
      bounds.horizontalMinimum,
      bounds.horizontalMaximum,
      resolution,
    ),
  );
  const maximumX = Math.min(
    resolution - 1,
    toPixel(
      ellipse.horizontal + ellipse.horizontalRadius,
      bounds.horizontalMinimum,
      bounds.horizontalMaximum,
      resolution,
    ),
  );
  const minimumY = Math.max(
    0,
    toPixel(
      ellipse.vertical - ellipse.verticalRadius,
      bounds.verticalMinimum,
      bounds.verticalMaximum,
      resolution,
    ),
  );
  const maximumY = Math.min(
    resolution - 1,
    toPixel(
      ellipse.vertical + ellipse.verticalRadius,
      bounds.verticalMinimum,
      bounds.verticalMaximum,
      resolution,
    ),
  );

  for (let y = minimumY; y <= maximumY; y += 1) {
    const worldY =
      bounds.verticalMinimum + ((y + 0.5) / resolution) * verticalSpan;
    const normalizedY = (worldY - ellipse.vertical) / ellipse.verticalRadius;

    for (let x = minimumX; x <= maximumX; x += 1) {
      const worldX =
        bounds.horizontalMinimum + ((x + 0.5) / resolution) * horizontalSpan;
      const normalizedX =
        (worldX - ellipse.horizontal) / ellipse.horizontalRadius;

      if (normalizedX ** 2 + normalizedY ** 2 <= 1) {
        mask[y * resolution + x] = 1;
      }
    }
  }
}

function countMask(mask) {
  let count = 0;
  for (const value of mask) count += value;
  return count;
}

function analyzeProjection(tree, horizontalAxis, resolution) {
  const bounds = calculateProjectionBounds(tree, horizontalAxis);
  const coreMask = new Uint8Array(resolution * resolution);
  const combinedMask = new Uint8Array(resolution * resolution);

  for (const lobe of tree.lobes) {
    const ellipse = {
      horizontal: lobe.position[horizontalAxis],
      vertical: lobe.position.y,
      horizontalRadius: lobe.scale[horizontalAxis],
      verticalRadius: lobe.scale.y,
    };
    rasterizeEllipse(coreMask, resolution, bounds, ellipse);
    rasterizeEllipse(combinedMask, resolution, bounds, ellipse);
  }

  for (const instance of tree.shell) {
    rasterizeEllipse(combinedMask, resolution, bounds, {
      horizontal: instance.position[horizontalAxis],
      vertical: instance.position.y,
      horizontalRadius:
        instance.scale * SHELL_HORIZONTAL_RADIUS_FACTOR,
      verticalRadius: instance.scale * SHELL_VERTICAL_RADIUS_FACTOR,
    });
  }

  const coreCount = countMask(coreMask);
  const combinedCount = countMask(combinedMask);
  const components = countComponents(combinedMask, resolution, resolution);

  return {
    contribution:
      coreCount === 0 ? 0 : Math.max(0, combinedCount - coreCount) / coreCount,
    componentCount: components.count,
    holeRatio: calculateHoleRatio(
      combinedMask,
      resolution,
      resolution,
      combinedCount,
    ),
  };
}

function calculateOutwardAlignment(instance, lobe) {
  const radial = normalizeVector({
    x: instance.position.x - lobe.position.x,
    y: instance.position.y - lobe.position.y,
    z: instance.position.z - lobe.position.z,
  });

  return (
    radial.x * instance.normal.x +
    radial.y * instance.normal.y +
    radial.z * instance.normal.z
  );
}

function isOccluded(instance, lobes) {
  return lobes.some(
    (lobe) =>
      lobe.id !== instance.lobeId &&
      normalizedRotatedPointDistance(instance.position, lobe) < 1,
  );
}

function createPositionKey(instance) {
  return [instance.position.x, instance.position.y, instance.position.z]
    .map((value) => value.toFixed(POSITION_KEY_PRECISION))
    .join(':');
}

export function analyzeFoliageShell(tree, preset, resolution) {
  const lobesById = new Map(tree.lobes.map((lobe) => [lobe.id, lobe]));
  const perLobeCounts = new Map(tree.lobes.map((lobe) => [lobe.id, 0]));
  const surfaceDistances = [];
  const normalErrors = [];
  const outwardAlignments = [];
  const exposures = [];
  const scales = [];
  const positionKeys = new Set();
  let duplicatePositions = 0;
  let missingSources = 0;
  let occluded = 0;

  for (const instance of tree.shell) {
    const lobe = lobesById.get(instance.lobeId);
    if (!lobe) {
      missingSources += 1;
      continue;
    }

    perLobeCounts.set(instance.lobeId, perLobeCounts.get(instance.lobeId) + 1);
    surfaceDistances.push(
      normalizedRotatedPointDistance(instance.position, lobe),
    );
    normalErrors.push(
      Math.abs(
        Math.hypot(
          instance.normal.x,
          instance.normal.y,
          instance.normal.z,
        ) - 1,
      ),
    );
    outwardAlignments.push(calculateOutwardAlignment(instance, lobe));
    exposures.push(instance.exposure);
    scales.push(instance.scale);
    if (isOccluded(instance, tree.lobes)) occluded += 1;

    const positionKey = createPositionKey(instance);
    if (positionKeys.has(positionKey)) duplicatePositions += 1;
    positionKeys.add(positionKey);
  }

  const counts = [...perLobeCounts.values()];
  const front = analyzeProjection(tree, 'x', resolution);
  const side = analyzeProjection(tree, 'z', resolution);
  const lobeExposure = tree.lobeExposure;

  return {
    shellInstanceCount: tree.shell.length,
    leafCardCount:
      tree.shell.length * preset.foliage.shell.planesPerCluster,
    shellMinimumInstancesPerLobe: Math.min(...counts),
    shellMaximumInstancesPerLobe: Math.max(...counts),
    shellMissingSourceLobeCount: missingSources,
    shellDuplicatePositionCount: duplicatePositions,
    shellMinimumSurfaceDistance: Math.min(...surfaceDistances),
    shellMaximumSurfaceDistance: Math.max(...surfaceDistances),
    shellMeanSurfaceDistance: mean(surfaceDistances),
    shellMaximumNormalLengthError: Math.max(...normalErrors),
    shellMinimumOutwardAlignment: Math.min(...outwardAlignments),
    shellMeanOutwardAlignment: mean(outwardAlignments),
    shellMinimumExposure: Math.min(...exposures),
    shellMeanExposure: mean(exposures),
    shellMaximumExposure: Math.max(...exposures),
    shellOccludedRatio: tree.shell.length === 0 ? 0 : occluded / tree.shell.length,
    shellMinimumScale: Math.min(...scales),
    shellMaximumScale: Math.max(...scales),
    lobeMinimumExposure: Math.min(...lobeExposure),
    lobeMeanExposure: mean(lobeExposure),
    lobeMaximumExposure: Math.max(...lobeExposure),
    shellSilhouetteContribution: Math.min(
      front.contribution,
      side.contribution,
    ),
    shellSilhouetteComponentCount: Math.max(
      front.componentCount,
      side.componentCount,
    ),
    shellSilhouetteHoleRatio: Math.max(front.holeRatio, side.holeRatio),
  };
}
