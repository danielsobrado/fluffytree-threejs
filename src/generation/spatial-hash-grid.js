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
    // Nested integer-keyed maps rather than one map on a joined string key.
    // A neighbourhood query touches twenty-seven cells, and building a string
    // for each of them allocated more than the selection it was serving. The
    // nesting is exact where a numeric hash of the triple would collide, and a
    // collision here would silently merge two cells.
    this.cells = new Map();
  }

  cellIndex(value) {
    return Math.floor(value / this.cellSize);
  }

  insert(position, entry) {
    const x = this.cellIndex(position.x);
    const y = this.cellIndex(position.y);
    const z = this.cellIndex(position.z);

    let byY = this.cells.get(x);
    if (!byY) {
      byY = new Map();
      this.cells.set(x, byY);
    }

    let byZ = byY.get(y);
    if (!byZ) {
      byZ = new Map();
      byY.set(y, byZ);
    }

    const cell = byZ.get(z);
    if (cell) cell.push(entry);
    else byZ.set(z, [entry]);
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
      const byY = this.cells.get(x);
      if (!byY) continue;

      for (let y = centerY - rings; y <= centerY + rings; y += 1) {
        const byZ = byY.get(y);
        if (!byZ) continue;

        for (let z = centerZ - rings; z <= centerZ + rings; z += 1) {
          const cell = byZ.get(z);
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
    for (const byY of this.cells.values()) {
      for (const byZ of byY.values()) {
        for (const cell of byZ.values()) total += cell.length;
      }
    }
    return total;
  }
}
