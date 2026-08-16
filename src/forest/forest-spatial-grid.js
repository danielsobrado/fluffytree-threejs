function requireChunkSize(value) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError('Forest chunk size must be a positive finite number.');
  }
  return value;
}

function validatePosition(position, path = 'position') {
  if (
    !position ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y ?? 0) ||
    !Number.isFinite(position.z)
  ) {
    throw new TypeError(`${path} must contain finite x, y and z coordinates.`);
  }
}

export class ForestSpatialGrid {
  constructor({ chunkSize }) {
    this.chunkSize = requireChunkSize(chunkSize);
    this.chunks = new Map();
    this.entries = new Map();
  }

  coordinatesForPosition(position) {
    validatePosition(position);
    return {
      x: Math.floor(position.x / this.chunkSize),
      z: Math.floor(position.z / this.chunkSize),
    };
  }

  keyForCoordinates(x, z) {
    return `${x}:${z}`;
  }

  keyForPosition(position) {
    const coordinates = this.coordinatesForPosition(position);
    return this.keyForCoordinates(coordinates.x, coordinates.z);
  }

  addToChunk(key, instance) {
    const chunk = this.chunks.get(key) ?? new Map();
    chunk.set(instance.id, instance);
    this.chunks.set(key, chunk);
  }

  removeFromChunk(key, instanceId) {
    const chunk = this.chunks.get(key);
    if (!chunk) return;
    chunk.delete(instanceId);
    if (chunk.size === 0) this.chunks.delete(key);
  }

  register(instance) {
    if (!instance || instance.id === undefined || instance.id === null) {
      throw new TypeError('Forest instance requires an id.');
    }
    validatePosition(instance.position, `instance '${instance.id}'.position`);
    if (this.entries.has(instance.id)) {
      throw new Error(`Forest instance '${instance.id}' is already registered.`);
    }
    const key = this.keyForPosition(instance.position);
    this.entries.set(instance.id, { instance, chunkKey: key });
    this.addToChunk(key, instance);
    return key;
  }

  update(instance) {
    const record = this.entries.get(instance?.id);
    if (!record) throw new Error(`Unknown forest instance '${instance?.id}'.`);
    validatePosition(instance.position, `instance '${instance.id}'.position`);
    const nextKey = this.keyForPosition(instance.position);
    if (nextKey !== record.chunkKey) {
      this.removeFromChunk(record.chunkKey, instance.id);
      this.addToChunk(nextKey, instance);
      record.chunkKey = nextKey;
    } else {
      this.chunks.get(nextKey).set(instance.id, instance);
    }
    record.instance = instance;
    return nextKey;
  }

  remove(instanceId) {
    const record = this.entries.get(instanceId);
    if (!record) return false;
    this.removeFromChunk(record.chunkKey, instanceId);
    this.entries.delete(instanceId);
    return true;
  }

  queryRadius(center, radius) {
    validatePosition(center, 'query center');
    if (!Number.isFinite(radius) || radius < 0) {
      throw new RangeError('Forest query radius must be non-negative.');
    }
    const minimum = this.coordinatesForPosition({
      x: center.x - radius,
      y: center.y ?? 0,
      z: center.z - radius,
    });
    const maximum = this.coordinatesForPosition({
      x: center.x + radius,
      y: center.y ?? 0,
      z: center.z + radius,
    });
    const radiusSquared = radius * radius;
    const result = [];

    for (let x = minimum.x; x <= maximum.x; x += 1) {
      for (let z = minimum.z; z <= maximum.z; z += 1) {
        const chunk = this.chunks.get(this.keyForCoordinates(x, z));
        if (!chunk) continue;
        for (const instance of chunk.values()) {
          const dx = instance.position.x - center.x;
          const dz = instance.position.z - center.z;
          if (dx * dx + dz * dz <= radiusSquared) result.push(instance);
        }
      }
    }
    return result;
  }

  chunkKeyForInstance(instanceId) {
    return this.entries.get(instanceId)?.chunkKey ?? null;
  }

  clear() {
    this.chunks.clear();
    this.entries.clear();
  }

  get metrics() {
    return Object.freeze({
      instanceCount: this.entries.size,
      chunkCount: this.chunks.size,
      chunkSize: this.chunkSize,
    });
  }
}
