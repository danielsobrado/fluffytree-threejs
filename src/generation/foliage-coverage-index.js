import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { SpatialHashGrid } from './spatial-hash-grid.js';

function normalDot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function distance(left, right) {
  return Math.hypot(
    left.x - right.x,
    left.y - right.y,
    left.z - right.z,
  );
}

function coverageTargetPosition(item) {
  return item.surfacePoint ?? item.position;
}

function isCompatible(candidate, selected) {
  return (
    normalDot(candidate.normal, selected.normal) >=
    FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot
  );
}

function coverageRatio(candidate, selected) {
  if (!isCompatible(candidate, selected)) return Number.POSITIVE_INFINITY;
  return (
    distance(coverageTargetPosition(candidate), selected.position) /
    selected.coverageRadius
  );
}

export class FoliageCoverageIndex {
  constructor(maximumCoverageRadius) {
    if (!(maximumCoverageRadius > 0)) {
      throw new RangeError('Foliage coverage requires a positive maximum radius.');
    }

    this.maximumCoverageRadius = maximumCoverageRadius;
    this.grid = new SpatialHashGrid(
      Math.max(
        maximumCoverageRadius,
        FOLIAGE_SHELL_CONSTANTS.minimumCellSize,
      ),
    );
    this.selected = [];
  }

  add(instance) {
    if (!(instance.coverageRadius > 0)) {
      throw new RangeError('Selected foliage requires a positive coverage radius.');
    }

    this.selected.push(instance);
    this.grid.insert(instance.position, instance);
  }

  nearestRatio(candidate) {
    if (this.selected.length === 0) return Number.POSITIVE_INFINITY;

    let nearest = Number.POSITIVE_INFINITY;
    const visited = new Set();

    for (
      let rings = 1;
      rings <= FOLIAGE_SHELL_CONSTANTS.maximumCoverageSearchRings;
      rings += 1
    ) {
      this.grid.forEachNear(
        coverageTargetPosition(candidate),
        rings,
        (selected) => {
        if (visited.has(selected)) return false;
        visited.add(selected);
        nearest = Math.min(nearest, coverageRatio(candidate, selected));
        return false;
        },
      );

      const unscannedDistance = rings * this.grid.cellSize;
      if (
        Number.isFinite(nearest) &&
        nearest * this.maximumCoverageRadius <= unscannedDistance
      ) {
        return nearest;
      }
    }

    for (const selected of this.selected) {
      if (visited.has(selected)) continue;
      nearest = Math.min(nearest, coverageRatio(candidate, selected));
    }

    return nearest;
  }
}
