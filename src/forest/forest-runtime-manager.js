import { resolveRawLod, resolveStableLod } from '../rendering/tree-lod-math.js';
import {
  TREE_REPRESENTATION_ROLES,
  treeRepresentationRoleAt,
} from '../rendering/tree-representation-role.js';
import {
  calculateCameraFocalPixels,
  calculateProjectedTreePixels,
} from '../rendering/tree-projection-math.js';
import { FOREST_CHUNK_STATES, forestChunkStateRank } from './forest-chunk-state.js';
import { ForestChunkStateTracker } from './forest-chunk-state-tracker.js';
import { ForestSpatialGrid } from './forest-spatial-grid.js';

function roleForLevel(level) {
  return treeRepresentationRoleAt(level) ?? TREE_REPRESENTATION_ROLES.CULLED;
}

function chunkStateForRole(role) {
  if (role === TREE_REPRESENTATION_ROLES.HERO) return FOREST_CHUNK_STATES.HERO_READY;
  if (role === TREE_REPRESENTATION_ROLES.NEAR) return FOREST_CHUNK_STATES.NEAR_READY;
  if (role === TREE_REPRESENTATION_ROLES.AGGREGATE) {
    return FOREST_CHUNK_STATES.AGGREGATE_READY;
  }
  if (role === TREE_REPRESENTATION_ROLES.IMPOSTOR) {
    return FOREST_CHUNK_STATES.IMPOSTOR_READY;
  }
  return FOREST_CHUNK_STATES.METADATA_ONLY;
}

function distanceBetween(left, right) {
  return Math.max(
    0.001,
    Math.hypot(
      left.x - right.x,
      (left.y ?? 0) - (right.y ?? 0),
      left.z - right.z,
    ),
  );
}

function validateInstance(instance) {
  if (!Number.isFinite(instance?.height) || instance.height <= 0) {
    throw new RangeError(`Forest instance '${instance?.id}' requires a positive height.`);
  }
}

export class ForestRuntimeManager {
  constructor({ runtimePolicy, lodSettings, spatialGrid = null, chunkTracker = null }) {
    if (!runtimePolicy) throw new TypeError('ForestRuntimeManager requires runtimePolicy.');
    if (!lodSettings) throw new TypeError('ForestRuntimeManager requires lodSettings.');
    this.runtimePolicy = runtimePolicy;
    this.lodSettings = lodSettings;
    this.grid =
      spatialGrid ?? new ForestSpatialGrid({ chunkSize: runtimePolicy.chunkSize });
    this.chunkTracker = chunkTracker ?? new ForestChunkStateTracker();
    this.instanceLevels = new Map();
    this.activeChunkKeys = new Set();
  }

  register(instance) {
    validateInstance(instance);
    return this.grid.register(instance);
  }

  updateInstance(instance) {
    validateInstance(instance);
    return this.grid.update(instance);
  }

  remove(instanceId) {
    this.instanceLevels.delete(instanceId);
    return this.grid.remove(instanceId);
  }

  classifyInstance(instance, cameraPosition, focalPixels) {
    const distance = distanceBetween(instance.position, cameraPosition);
    const projectedPixels = calculateProjectedTreePixels(
      instance.height,
      distance,
      focalPixels,
    );
    const previousLevel = this.instanceLevels.get(instance.id);
    const level =
      previousLevel === undefined
        ? resolveRawLod(projectedPixels, this.lodSettings)
        : resolveStableLod(projectedPixels, previousLevel, this.lodSettings);
    this.instanceLevels.set(instance.id, level);
    return {
      instance,
      distance,
      projectedPixels,
      level,
      role: roleForLevel(level),
    };
  }

  requestChunkStates(activeEntries) {
    const desired = new Map();
    const priorities = new Map();
    for (const entry of activeEntries) {
      const chunkKey = this.grid.chunkKeyForInstance(entry.instance.id);
      if (!chunkKey) continue;
      const state = chunkStateForRole(entry.role);
      const existing = desired.get(chunkKey) ?? FOREST_CHUNK_STATES.METADATA_ONLY;
      if (forestChunkStateRank(state) > forestChunkStateRank(existing)) {
        desired.set(chunkKey, state);
      } else if (!desired.has(chunkKey)) {
        desired.set(chunkKey, existing);
      }
      priorities.set(
        chunkKey,
        Math.max(priorities.get(chunkKey) ?? 0, entry.projectedPixels),
      );
    }

    const nextActiveChunkKeys = new Set(desired.keys());
    for (const chunkKey of this.activeChunkKeys) {
      if (!nextActiveChunkKeys.has(chunkKey)) {
        desired.set(chunkKey, FOREST_CHUNK_STATES.UNLOADED);
        priorities.set(chunkKey, -1);
      }
    }
    this.activeChunkKeys = nextActiveChunkKeys;

    const transitions = [];
    for (const [chunkKey, state] of desired) {
      const token = this.chunkTracker.request(chunkKey, state);
      if (token.currentState !== token.desiredState) {
        transitions.push(
          Object.freeze({
            ...token,
            priority: priorities.get(chunkKey) ?? 0,
          }),
        );
      }
    }
    return Object.freeze(transitions);
  }

  update({
    cameraPosition,
    fieldOfViewDegrees,
    viewportHeight,
    visibilityPredicate = null,
  }) {
    const focalPixels = calculateCameraFocalPixels(
      fieldOfViewDegrees,
      viewportHeight,
    );
    const candidates = this.grid.queryRadius(
      cameraPosition,
      this.runtimePolicy.visibilityRadius,
    );
    const entries = [];
    for (const instance of candidates) {
      if (visibilityPredicate && !visibilityPredicate(instance)) continue;
      entries.push(this.classifyInstance(instance, cameraPosition, focalPixels));
    }
    entries.sort((left, right) => right.projectedPixels - left.projectedPixels);
    const activeEntries = entries.filter(
      (entry) => entry.role !== TREE_REPRESENTATION_ROLES.CULLED,
    );
    const transitions = this.requestChunkStates(entries);

    return Object.freeze({
      entries: Object.freeze(entries),
      activeEntries: Object.freeze(activeEntries),
      transitions,
      metrics: Object.freeze({
        registeredInstanceCount: this.grid.metrics.instanceCount,
        candidateCount: candidates.length,
        activeCount: activeEntries.length,
        transitionCount: transitions.length,
      }),
    });
  }

  scheduleTransitions(updateResult, queue, handler) {
    if (!queue?.enqueue || typeof handler !== 'function') {
      throw new TypeError('Forest transition scheduling requires a queue and handler.');
    }
    for (const token of updateResult.transitions) {
      queue.enqueue(`forest-chunk:${token.chunkKey}`, token.priority, () => {
        if (!this.chunkTracker.isCurrent(token)) return;
        const completedState = handler(token) ?? token.desiredState;
        this.chunkTracker.complete(token, completedState);
      });
    }
  }

  clear() {
    this.grid.clear();
    this.chunkTracker.clear();
    this.instanceLevels.clear();
    this.activeChunkKeys.clear();
  }

  get metrics() {
    return Object.freeze({
      grid: this.grid.metrics,
      chunks: this.chunkTracker.metrics,
      trackedLodCount: this.instanceLevels.size,
    });
  }
}
