import assert from 'node:assert/strict';
import test from 'node:test';
import { FoliageShellGeometryFactory } from '../src/rendering/foliage-shell-geometry-factory.js';

test('geometry subsets contain only the requested certified planes', () => {
  const factory = new FoliageShellGeometryFactory();
  const full = factory.create(2);
  const guard = factory.create(2, { firstPlaneIndex: 1, planeCount: 1 });

  assert.equal(full.index.count, 12);
  assert.equal(full.attributes.position.count, 8);
  assert.equal(guard.index.count, 6);
  assert.equal(guard.attributes.position.count, 4);

  full.dispose();
  guard.dispose();
});

test('geometry subsets reject ranges outside the certified cluster', () => {
  const factory = new FoliageShellGeometryFactory();

  assert.throws(
    () => factory.create(2, { firstPlaneIndex: 2, planeCount: 1 }),
    RangeError,
  );
  assert.throws(
    () => factory.create(2, { firstPlaneIndex: 1, planeCount: 2 }),
    RangeError,
  );
});
