import { TREE_RENDER_REPRESENTATION_ROLES } from '../rendering/tree-representation-role.js';

const MAXIMUM_SEED = 0xffffffff;

function validateAssignment(assignment, index) {
  if (!assignment) {
    throw new TypeError(`Forest batch entry ${index} requires an assignment.`);
  }
  if (typeof assignment.shared !== 'boolean') {
    throw new TypeError(`Forest batch entry ${index} assignment.shared must be boolean.`);
  }
  if (
    !Number.isSafeInteger(assignment.seed) ||
    assignment.seed < 0 ||
    assignment.seed > MAXIMUM_SEED
  ) {
    throw new RangeError(
      `Forest batch entry ${index} assignment.seed must be an unsigned 32-bit integer.`,
    );
  }
  if (
    assignment.shared &&
    (!Number.isSafeInteger(assignment.variantIndex) || assignment.variantIndex < 0)
  ) {
    throw new RangeError(
      `Forest batch entry ${index} shared assignment requires a non-negative variant index.`,
    );
  }
}

function validateEntry(entry, index) {
  validateAssignment(entry?.assignment, index);
  if (!TREE_RENDER_REPRESENTATION_ROLES.includes(entry.role)) {
    throw new Error(
      `Forest batch entry ${index} has unsupported role '${entry.role}'.`,
    );
  }
}

function createBatchKey(parts) {
  return JSON.stringify(parts);
}

function sharedBatchKey(entry) {
  const { assignment } = entry;
  return createBatchKey([
    'shared',
    assignment.presetId,
    assignment.variantIndex,
    assignment.seed,
    entry.role,
  ]);
}

function uniqueBatchKey(entry) {
  const { assignment } = entry;
  return createBatchKey([
    'unique',
    assignment.presetId,
    assignment.instanceId,
    assignment.seed,
    entry.role,
  ]);
}

function freezeBatch(batch) {
  return Object.freeze({
    ...batch,
    instanceIds: Object.freeze(batch.instanceIds),
    entries: Object.freeze(batch.entries),
  });
}

export class ForestInstanceBatchPlanner {
  plan(entries) {
    if (!Array.isArray(entries)) {
      throw new TypeError('Forest batch planner requires an entry array.');
    }
    const batches = new Map();

    entries.forEach((entry, index) => {
      validateEntry(entry, index);
      const instancingEligible = entry.assignment.shared;
      const key = instancingEligible
        ? sharedBatchKey(entry)
        : uniqueBatchKey(entry);
      if (!batches.has(key)) {
        batches.set(key, {
          key,
          presetId: entry.assignment.presetId,
          variantIndex: entry.assignment.variantIndex,
          seed: entry.assignment.seed,
          role: entry.role,
          instancingEligible,
          instanceIds: [],
          entries: [],
        });
      }
      const batch = batches.get(key);
      batch.instanceIds.push(entry.assignment.instanceId);
      batch.entries.push(entry);
    });

    const planned = Object.freeze([...batches.values()].map(freezeBatch));
    return Object.freeze({
      batches: planned,
      metrics: Object.freeze({
        instanceCount: entries.length,
        batchCount: planned.length,
        instancedBatchCount: planned.filter((batch) => batch.instancingEligible).length,
        uniqueBatchCount: planned.filter((batch) => !batch.instancingEligible).length,
      }),
    });
  }
}
