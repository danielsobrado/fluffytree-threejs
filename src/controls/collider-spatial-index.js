export const COLLIDER_GRID_CELL_SIZE = 4;

function requirePositiveFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    throw new RangeError(`${label} must be finite and positive.`);
  }
  return number;
}

function requireFinite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new RangeError(`${label} must be finite.`);
  }
  return number;
}

function requireCollider(collider) {
  if (!collider || typeof collider !== 'object') {
    throw new TypeError('Collider spatial index requires collider objects.');
  }
  return {
    collider,
    x: requireFinite(collider.x, 'Collider x'),
    z: requireFinite(collider.z, 'Collider z'),
    radius: requirePositiveFinite(collider.radius, 'Collider radius'),
  };
}

export class ColliderSpatialIndex {
  constructor({ cellSize = COLLIDER_GRID_CELL_SIZE } = {}) {
    this.cellSize = requirePositiveFinite(cellSize, 'Collider grid cellSize');
    this.columns = new Map();
    this.seenRevision = new Map();
    this.revision = 0;
  }

  cellCoordinate(value) {
    return Math.floor(value / this.cellSize);
  }

  getBucket(column, row, create = false) {
    let rows = this.columns.get(column);
    if (!rows && create) {
      rows = new Map();
      this.columns.set(column, rows);
    }
    if (!rows) return null;

    let bucket = rows.get(row);
    if (!bucket && create) {
      bucket = [];
      rows.set(row, bucket);
    }
    return bucket ?? null;
  }

  rebuild(colliders) {
    if (!Array.isArray(colliders)) {
      throw new TypeError('Collider spatial index requires an array.');
    }

    this.columns.clear();
    this.seenRevision.clear();
    this.revision = 0;

    for (const rawCollider of colliders) {
      const { collider, x, z, radius } = requireCollider(rawCollider);
      const minimumColumn = this.cellCoordinate(x - radius);
      const maximumColumn = this.cellCoordinate(x + radius);
      const minimumRow = this.cellCoordinate(z - radius);
      const maximumRow = this.cellCoordinate(z + radius);

      for (let column = minimumColumn; column <= maximumColumn; column += 1) {
        for (let row = minimumRow; row <= maximumRow; row += 1) {
          this.getBucket(column, row, true).push(collider);
        }
      }
    }
    return this;
  }

  query(x, z, padding = 0, result = []) {
    const queryX = requireFinite(x, 'Collider query x');
    const queryZ = requireFinite(z, 'Collider query z');
    const queryPadding = Number(padding);
    if (!Number.isFinite(queryPadding) || queryPadding < 0) {
      throw new RangeError('Collider query padding must be finite and non-negative.');
    }
    if (!Array.isArray(result)) {
      throw new TypeError('Collider query result must be an array.');
    }

    result.length = 0;
    this.revision += 1;
    if (this.revision >= Number.MAX_SAFE_INTEGER) {
      this.seenRevision.clear();
      this.revision = 1;
    }

    const range = Math.ceil(queryPadding / this.cellSize);
    const centerColumn = this.cellCoordinate(queryX);
    const centerRow = this.cellCoordinate(queryZ);

    for (let column = centerColumn - range; column <= centerColumn + range; column += 1) {
      for (let row = centerRow - range; row <= centerRow + range; row += 1) {
        const bucket = this.getBucket(column, row);
        if (!bucket) continue;

        for (const collider of bucket) {
          if (this.seenRevision.get(collider) === this.revision) continue;
          this.seenRevision.set(collider, this.revision);
          result.push(collider);
        }
      }
    }
    return result;
  }
}
