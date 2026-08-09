import { foliageCardCoverageRatio } from './foliage-card-coverage.js';
import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { SpatialHashGrid } from './spatial-hash-grid.js';

function coverageTargetPosition(item) {
  return item.surfacePoint ?? item.position;
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
          nearest = Math.min(
            nearest,
            foliageCardCoverageRatio(candidate, selected),
          );
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
      nearest = Math.min(
        nearest,
        foliageCardCoverageRatio(candidate, selected),
      );
    }

    return nearest;
  }
}
