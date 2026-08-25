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
    if (instance.coverageRadius > this.maximumCoverageRadius) {
      throw new RangeError(
        'Selected foliage coverage radius exceeds the index maximum.',
      );
    }

    this.selected.push(instance);
    this.grid.insert(instance.position, instance);
  }

  nearestRatio(candidate) {
    if (this.selected.length === 0) return Number.POSITIVE_INFINITY;

    const position = coverageTargetPosition(candidate);
    const maximumRings = FOLIAGE_SHELL_CONSTANTS.maximumCoverageSearchRings;
    let nearest = Number.POSITIVE_INFINITY;
    const measure = (selected) => {
      nearest = Math.min(
        nearest,
        foliageCardCoverageRatio(candidate, selected),
      );
      return false;
    };

    this.grid.forEachNear(position, 1, measure);
    if (
      Number.isFinite(nearest) &&
      nearest * this.maximumCoverageRadius <= this.grid.cellSize
    ) {
      return nearest;
    }

    for (let rings = 2; rings <= maximumRings; rings += 1) {
      this.grid.forEachShell(position, rings, measure);
      const unscannedDistance = rings * this.grid.cellSize;
      if (
        Number.isFinite(nearest) &&
        nearest * this.maximumCoverageRadius <= unscannedDistance
      ) {
        return nearest;
      }
    }

    const centerX = this.grid.cellIndex(position.x);
    const centerY = this.grid.cellIndex(position.y);
    const centerZ = this.grid.cellIndex(position.z);
    for (const selected of this.selected) {
      const x = this.grid.cellIndex(selected.position.x);
      const y = this.grid.cellIndex(selected.position.y);
      const z = this.grid.cellIndex(selected.position.z);
      if (
        Math.abs(x - centerX) <= maximumRings &&
        Math.abs(y - centerY) <= maximumRings &&
        Math.abs(z - centerZ) <= maximumRings
      ) {
        continue;
      }
      measure(selected);
    }

    return nearest;
  }
}
