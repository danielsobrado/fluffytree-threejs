import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFoliageLodCoverageRepresentation,
  foliageLodCoverageCacheKey,
  resolveFoliageLodCoveragePlaneCount,
} from '../src/rendering/foliage-lod-coverage-representation.js';

test('ordinary LOD coverage uses rendered planes while repairs keep certified planes', () => {
  const normal = { id: 1, planesPerCluster: 2, alphaProfile: { planesPerCluster: 2 } };
  const repair = {
    id: 2,
    planesPerCluster: 2,
    coverageRepairKind: 'witnessed',
  };
  const representation = createFoliageLodCoverageRepresentation(
    [normal, repair],
    1,
  );

  assert.equal(resolveFoliageLodCoveragePlaneCount(normal, 1), 1);
  assert.equal(resolveFoliageLodCoveragePlaneCount(repair, 1), 2);
  assert.notEqual(representation[0], normal);
  assert.equal(representation[0].planesPerCluster, 1);
  assert.equal(representation[0].alphaProfile, undefined);
  assert.equal(representation[1], repair);
});

test('full certified representation preserves source instances', () => {
  const instances = [{ id: 1, planesPerCluster: 2 }];
  assert.equal(createFoliageLodCoverageRepresentation(instances, null), instances);
});

test('coverage cache separates selections by rendered plane count', () => {
  assert.notEqual(
    foliageLodCoverageCacheKey(0.75, 1),
    foliageLodCoverageCacheKey(0.75, 2),
  );
  assert.throws(
    () => createFoliageLodCoverageRepresentation([], 0),
    RangeError,
  );
});
