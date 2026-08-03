import assert from 'node:assert/strict';
import test from 'node:test';
import { selectFoliageLodInstances } from '../src/rendering/foliage-lod-selector.js';

function createInstance(id, lobeId, angle, exposure = 0.5) {
  return {
    id,
    lobeId,
    normal: {
      x: Math.cos(angle),
      y: Math.sin(angle * 0.5) * 0.35,
      z: Math.sin(angle),
    },
    exposure,
  };
}

function countByLobe(instances) {
  const counts = new Map();
  for (const instance of instances) {
    counts.set(instance.lobeId, (counts.get(instance.lobeId) ?? 0) + 1);
  }
  return counts;
}

test('full-density foliage selection preserves every source instance', () => {
  const instances = [
    createInstance(0, 0, 0),
    createInstance(1, 0, Math.PI),
  ];
  const selection = selectFoliageLodInstances(instances, 1);

  assert.equal(selection.instances, instances);
  assert.equal(selection.actualDensity, 1);
  assert.equal(selection.scaleCompensation, 1);
});

test('reduced foliage selection is deterministic and proportionally covers every lobe', () => {
  const instances = [
    ...Array.from({ length: 8 }, (_, index) =>
      createInstance(index, 0, (index / 8) * Math.PI * 2),
    ),
    ...Array.from({ length: 4 }, (_, index) =>
      createInstance(100 + index, 1, (index / 4) * Math.PI * 2),
    ),
  ];
  const first = selectFoliageLodInstances(instances, 0.5);
  const second = selectFoliageLodInstances(instances, 0.5);
  const counts = countByLobe(first.instances);

  assert.deepEqual(
    first.instances.map((instance) => instance.id),
    second.instances.map((instance) => instance.id),
  );
  assert.equal(first.instances.length, 6);
  assert.equal(counts.get(0), 4);
  assert.equal(counts.get(1), 2);
});

test('surface strata retain the most exposed local representative', () => {
  const instances = [
    createInstance(0, 0, 0, 0.1),
    createInstance(1, 0, Math.PI * 0.5, 0.4),
    createInstance(2, 0, Math.PI, 0.95),
    createInstance(3, 0, Math.PI * 1.5, 0.2),
  ];
  const selection = selectFoliageLodInstances(instances, 0.25);

  assert.deepEqual(
    selection.instances.map((instance) => instance.id),
    [2],
  );
});

test('reduced foliage compensates projected card area without unbounded growth', () => {
  const instances = Array.from({ length: 8 }, (_, index) =>
    createInstance(index, 0, (index / 8) * Math.PI * 2),
  );
  const moderate = selectFoliageLodInstances(instances, 0.75);
  const sparse = selectFoliageLodInstances(instances, 0.25);

  assert.ok(
    Math.abs(moderate.scaleCompensation - 1 / Math.sqrt(0.75)) < 1e-12,
  );
  assert.equal(sparse.scaleCompensation, 1.2);
});

test('zero density is empty and invalid densities are rejected', () => {
  const instances = [createInstance(0, 0, 0)];

  assert.deepEqual(selectFoliageLodInstances(instances, 0).instances, []);
  assert.throws(
    () => selectFoliageLodInstances(instances, -0.01),
    RangeError,
  );
  assert.throws(
    () => selectFoliageLodInstances(instances, 1.01),
    RangeError,
  );
});
