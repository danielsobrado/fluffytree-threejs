import { createHash } from 'node:crypto';

const POSITION_PRECISION = 6;

function positionKey(positions, vertex) {
  const offset = vertex * 3;
  return [positions[offset], positions[offset + 1], positions[offset + 2]]
    .map((value) => value.toFixed(POSITION_PRECISION))
    .join(':');
}

function normalAt(normals, vertex) {
  const offset = vertex * 3;
  return [normals[offset], normals[offset + 1], normals[offset + 2]];
}

function distance(positions, left, right) {
  const leftOffset = left * 3;
  const rightOffset = right * 3;
  return Math.hypot(
    positions[leftOffset] - positions[rightOffset],
    positions[leftOffset + 1] - positions[rightOffset + 1],
    positions[leftOffset + 2] - positions[rightOffset + 2],
  );
}

class DisjointSet {
  constructor() {
    this.parent = [];
    this.rank = [];
  }

  add() {
    const id = this.parent.length;
    this.parent.push(id);
    this.rank.push(0);
    return id;
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

export function hashCrownVolume(volume) {
  return createHash('sha256')
    .update(Buffer.from(volume.positions.buffer))
    .update(Buffer.from(volume.normals.buffer))
    .digest('hex');
}

export function analyzeCrownVolume(volume) {
  const positionsByKey = new Map();
  const normalsByKey = new Map();
  const edges = new Map();
  const sets = new DisjointSet();
  let nonFiniteValueCount = 0;
  let maximumNormalLengthError = 0;
  let maximumCoincidentNormalDelta = 0;
  let maximumEdgeLength = 0;

  for (let vertex = 0; vertex < volume.vertexCount; vertex += 1) {
    const key = positionKey(volume.positions, vertex);
    let id = positionsByKey.get(key);
    const normal = normalAt(volume.normals, vertex);

    if (id === undefined) {
      id = sets.add();
      positionsByKey.set(key, id);
      normalsByKey.set(key, normal);
    } else {
      const existing = normalsByKey.get(key);
      maximumCoincidentNormalDelta = Math.max(
        maximumCoincidentNormalDelta,
        Math.hypot(
          normal[0] - existing[0],
          normal[1] - existing[1],
          normal[2] - existing[2],
        ),
      );
    }

    const offset = vertex * 3;
    for (let axis = 0; axis < 3; axis += 1) {
      if (!Number.isFinite(volume.positions[offset + axis])) {
        nonFiniteValueCount += 1;
      }
      if (!Number.isFinite(volume.normals[offset + axis])) {
        nonFiniteValueCount += 1;
      }
    }

    maximumNormalLengthError = Math.max(
      maximumNormalLengthError,
      Math.abs(Math.hypot(...normal) - 1),
    );
  }

  for (let triangle = 0; triangle < volume.triangleCount; triangle += 1) {
    const vertices = [triangle * 3, triangle * 3 + 1, triangle * 3 + 2];
    const ids = vertices.map((vertex) =>
      positionsByKey.get(positionKey(volume.positions, vertex)),
    );

    sets.union(ids[0], ids[1]);
    sets.union(ids[1], ids[2]);
    sets.union(ids[2], ids[0]);

    for (let edge = 0; edge < 3; edge += 1) {
      const left = ids[edge];
      const right = ids[(edge + 1) % 3];
      const key = left < right ? `${left}:${right}` : `${right}:${left}`;
      edges.set(key, (edges.get(key) ?? 0) + 1);
      maximumEdgeLength = Math.max(
        maximumEdgeLength,
        distance(
          volume.positions,
          vertices[edge],
          vertices[(edge + 1) % 3],
        ),
      );
    }
  }

  const components = new Set();
  for (let id = 0; id < sets.parent.length; id += 1) {
    components.add(sets.find(id));
  }

  let boundaryEdgeCount = 0;
  let nonManifoldEdgeCount = 0;
  for (const count of edges.values()) {
    if (count === 1) boundaryEdgeCount += 1;
    if (count > 2) nonManifoldEdgeCount += 1;
  }

  return {
    triangleCount: volume.triangleCount,
    vertexCount: volume.vertexCount,
    uniqueVertexCount: positionsByKey.size,
    componentCount: components.size,
    boundaryEdgeCount,
    nonManifoldEdgeCount,
    nonFiniteValueCount,
    maximumNormalLengthError,
    maximumCoincidentNormalDelta,
    maximumEdgeLength,
    maximumEdgeLengthRatio: maximumEdgeLength / volume.grid.cellSize,
  };
}
