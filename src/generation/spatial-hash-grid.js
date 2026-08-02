/**
 * Uniform grid over world space. Cells are the size of the largest query radius,
 * so every point within that radius of a query lies in the twenty-seven cells
 * around it and selection stays linear in the candidate count.
 */
export class SpatialHashGrid {
  constructor(cellSize) {
    if (!(cellSize > 0)) {
      throw new Error('A spatial hash grid requires a positive cell size.');
    }

    this.cellSize = cellSize;
    this.cells = new Map();
  }

  static key(x, y, z) {
    return `${x}:${y}:${z}`;
  }

  cellIndex(value) {
    return Math.floor(value / this.cellSize);
  }

  insert(position, entry) {
    const key = SpatialHashGrid.key(
      this.cellIndex(position.x),
      this.cellIndex(position.y),
      this.cellIndex(position.z),
    );
    const cell = this.cells.get(key);

    if (cell) cell.push(entry);
    else this.cells.set(key, [entry]);
  }

  /**
   * Visits every entry within `rings` cells of the position. Returns the first
   * entry for which the visitor is truthy, or null.
   */
  forEachNear(position, rings, visitor) {
    const centerX = this.cellIndex(position.x);
    const centerY = this.cellIndex(position.y);
    const centerZ = this.cellIndex(position.z);

    for (let x = centerX - rings; x <= centerX + rings; x += 1) {
      for (let y = centerY - rings; y <= centerY + rings; y += 1) {
        for (let z = centerZ - rings; z <= centerZ + rings; z += 1) {
          const cell = this.cells.get(SpatialHashGrid.key(x, y, z));
          if (!cell) continue;

          for (const entry of cell) {
            if (visitor(entry)) return entry;
          }
        }
      }
    }

    return null;
  }

  /**
   * Cells are at least as wide as the largest query radius, so a single ring is
   * enough for a containment test.
   */
  findNear(position, predicate) {
    return this.forEachNear(position, 1, predicate);
  }

  size() {
    let total = 0;
    for (const cell of this.cells.values()) total += cell.length;
    return total;
  }
}
