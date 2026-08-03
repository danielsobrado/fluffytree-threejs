import { FOLIAGE_SHELL_CONSTANTS } from './foliage-shell-constants.js';
import { SpatialHashGrid } from './spatial-hash-grid.js';

class DisjointSet {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = new Uint8Array(size);
  }

  find(value) {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];

    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(left, right) {
    let leftRoot = this.find(left);
    let rightRoot = this.find(right);
    if (leftRoot === rightRoot) return;

    if (this.rank[leftRoot] < this.rank[rightRoot]) {
      [leftRoot, rightRoot] = [rightRoot, leftRoot];
    }
    this.parent[rightRoot] = leftRoot;
    if (this.rank[leftRoot] === this.rank[rightRoot]) {
      this.rank[leftRoot] += 1;
    }
  }
}

function normalDot(left, right) {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function distanceSquared(left, right) {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}

function canShareCoverage(left, right) {
  if (
    normalDot(left.normal, right.normal) <
    FOLIAGE_SHELL_CONSTANTS.minimumCoverageNormalDot
  ) {
    return false;
  }

  const radius = Math.max(left.coverageRadius, right.coverageRadius);
  return distanceSquared(left.position, right.position) <= radius * radius;
}

export function createFoliageCoverageComponents(items) {
  if (items.length === 0) return [];

  const maximumRadius = Math.max(...items.map((item) => item.coverageRadius));
  const grid = new SpatialHashGrid(
    Math.max(maximumRadius, FOLIAGE_SHELL_CONSTANTS.minimumCellSize),
  );
  const itemIndex = new Map(items.map((item, index) => [item, index]));
  const components = new DisjointSet(items.length);

  for (const item of items) grid.insert(item.position, item);

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    grid.findNear(item.position, (other) => {
      const otherIndex = itemIndex.get(other);
      if (otherIndex <= index || !canShareCoverage(item, other)) return false;
      components.union(index, otherIndex);
      return false;
    });
  }

  const groups = new Map();
  for (let index = 0; index < items.length; index += 1) {
    const root = components.find(index);
    const group = groups.get(root) ?? [];
    group.push(items[index]);
    groups.set(root, group);
  }

  return [...groups.values()];
}
