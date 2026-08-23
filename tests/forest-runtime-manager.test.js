import assert from 'node:assert/strict';
import test from 'node:test';
import { PrioritizedFrameBudgetQueue } from '../src/generation/prioritized-frame-budget-queue.js';
import { ForestChunkStateTracker } from '../src/forest/forest-chunk-state-tracker.js';
import { FOREST_CHUNK_STATES } from '../src/forest/forest-chunk-state.js';
import { ForestRuntimeManager } from '../src/forest/forest-runtime-manager.js';
import { parseForestRuntimePolicy } from '../src/forest/forest-runtime-policy.js';
import { ForestSpatialGrid } from '../src/forest/forest-spatial-grid.js';
import { readYamlConfigSync } from '../tools/node-yaml-config.js';

const runtimePolicy = parseForestRuntimePolicy(
  readYamlConfigSync(new URL('../config/forest-runtime-policy.yaml', import.meta.url)),
);
const lodSettings = Object.freeze({
  nearPixels: 300,
  mediumPixels: 78,
  farPixels: 35,
  cullPixels: 12,
  hysteresis: 0.12,
  fadeBand: 0.15,
});

function tree(id, x, z, height = 8) {
  return { id, position: { x, y: 0, z }, height };
}

test('forest spatial grid only scans chunks intersecting the query radius', () => {
  const grid = new ForestSpatialGrid({ chunkSize: 10 });
  grid.register(tree('near', 2, 2));
  grid.register(tree('edge', 9, 0));
  grid.register(tree('far', 40, 40));

  assert.deepEqual(
    grid.queryRadius({ x: 0, y: 0, z: 0 }, 10).map((entry) => entry.id).sort(),
    ['edge', 'near'],
  );
  assert.equal(grid.metrics.chunkCount, 2);
});

test('chunk state tracker rejects stale completion tokens', () => {
  const tracker = new ForestChunkStateTracker();
  const first = tracker.request('0:0', FOREST_CHUNK_STATES.AGGREGATE_READY);
  const second = tracker.request('0:0', FOREST_CHUNK_STATES.HERO_READY);

  assert.equal(tracker.complete(first), false);
  assert.equal(tracker.complete(second), true);
  assert.equal(tracker.get('0:0').currentState, FOREST_CHUNK_STATES.HERO_READY);
});

test('prioritized queue replaces keyed tasks and runs highest priority first', () => {
  let time = 0;
  const queue = new PrioritizedFrameBudgetQueue({ now: () => time++ });
  const calls = [];
  queue.enqueue('same', 1, () => calls.push('stale'));
  queue.enqueue('same', 5, () => calls.push('replacement'));
  queue.enqueue('other', 3, () => calls.push('other'));

  queue.process(100);

  assert.deepEqual(calls, ['replacement', 'other']);
  assert.equal(queue.length, 0);
  assert.equal(queue.supersededCount, 1);
});

test('forest runtime classifies only nearby candidates with screen-space LOD', () => {
  const manager = new ForestRuntimeManager({ runtimePolicy, lodSettings });
  manager.register(tree('hero', 0, -10, 12));
  manager.register(tree('near', 0, -80, 8));
  manager.register(tree('outside', 0, -500, 15));

  const result = manager.update({
    cameraPosition: { x: 0, y: 2, z: 0 },
    fieldOfViewDegrees: 42,
    viewportHeight: 1080,
  });

  assert.equal(result.metrics.registeredInstanceCount, 3);
  assert.equal(result.metrics.candidateCount, 2);
  assert.equal(result.entries[0].instance.id, 'hero');
  assert.equal(result.entries[0].role, 'hero');
  assert.ok(result.activeEntries.every((entry) => entry.instance.id !== 'outside'));
});

test('forest transitions are versioned and scheduled by projected importance', () => {
  const manager = new ForestRuntimeManager({ runtimePolicy, lodSettings });
  manager.register(tree('large', 0, -12, 14));
  manager.register(tree('small', 80, -120, 5));
  const update = manager.update({
    cameraPosition: { x: 0, y: 2, z: 0 },
    fieldOfViewDegrees: 42,
    viewportHeight: 1080,
  });
  let time = 0;
  const queue = new PrioritizedFrameBudgetQueue({ now: () => time++ });
  const completed = [];

  manager.scheduleTransitions(update, queue, (token) => {
    completed.push(token.chunkKey);
  });
  queue.process(100);

  assert.equal(completed.length, update.transitions.length);
  assert.equal(manager.metrics.chunks.pendingCount, 0);
});

test('forest runtime retries an unload transition after handler failure', () => {
  const manager = new ForestRuntimeManager({ runtimePolicy, lodSettings });
  manager.register(tree('hero', 0, -10, 12));
  let time = 0;
  const queue = new PrioritizedFrameBudgetQueue({ now: () => time++ });
  const cameraNear = { x: 0, y: 2, z: 0 };
  const cameraFar = { x: 1000, y: 2, z: 0 };

  const visible = manager.update({
    cameraPosition: cameraNear,
    fieldOfViewDegrees: 42,
    viewportHeight: 1080,
  });
  manager.scheduleTransitions(visible, queue, () => undefined);
  queue.process(100);

  const unload = manager.update({
    cameraPosition: cameraFar,
    fieldOfViewDegrees: 42,
    viewportHeight: 1080,
  });
  manager.scheduleTransitions(unload, queue, () => {
    throw new Error('unload failed');
  });
  assert.throws(() => queue.process(100), /unload failed/);

  const retry = manager.update({
    cameraPosition: cameraFar,
    fieldOfViewDegrees: 42,
    viewportHeight: 1080,
  });
  assert.ok(
    retry.transitions.some(
      (token) => token.desiredState === FOREST_CHUNK_STATES.UNLOADED,
    ),
  );
});
