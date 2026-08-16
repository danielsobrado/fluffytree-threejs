import { TREE_RENDER_REPRESENTATION_ROLES } from '../rendering/tree-representation-role.js';

function validateEntry(entry, index) {
  if (!entry?.assignment) {
    throw new TypeError(`Forest batch entry ${index} requires an assignment.`);
  }
  if (!TREE_RENDER_REPRESENTATION_ROLES.includes(entry.role)) {
    throw new Error(
      `Forest batch entry ${index} has unsupported role '${entry.role}'.`,
    );
  }
}

function sharedBatchKey(entry) {
  const { assignment } = entry;
  return [
    assignment.presetId,
    assignment.variantIndex,
    entry.role,
  ].join(':');
}

function uniqueBatchKey(entry) {
  return [
    entry.assignment.presetId,
    'hero',
    entry.assignment.instanceId,
    entry.role,
  ].join(':');
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
