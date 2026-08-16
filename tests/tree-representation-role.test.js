import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TREE_RENDER_REPRESENTATION_ROLES,
  TREE_REPRESENTATION_ROLES,
  treeRepresentationIndex,
  treeRepresentationRoleAt,
} from '../src/rendering/tree-representation-role.js';
import { shouldRenderTreeShadowProxy } from '../src/rendering/tree-shadow-lod-policy.js';

test('tree render representations have stable semantic ordering', () => {
  assert.deepEqual(TREE_RENDER_REPRESENTATION_ROLES, [
    'hero',
    'near',
    'aggregate',
    'impostor',
  ]);
  for (const role of TREE_RENDER_REPRESENTATION_ROLES) {
    const index = treeRepresentationIndex(role);
    assert.equal(treeRepresentationRoleAt(index), role);
  }
  assert.equal(treeRepresentationRoleAt(99), null);
});

test('shadow policy is independent from numeric LOD indexes', () => {
  assert.equal(
    shouldRenderTreeShadowProxy(TREE_REPRESENTATION_ROLES.HERO, 120, 90),
    true,
  );
  assert.equal(
    shouldRenderTreeShadowProxy(TREE_REPRESENTATION_ROLES.NEAR, 120, 90),
    true,
  );
  assert.equal(
    shouldRenderTreeShadowProxy(
      TREE_REPRESENTATION_ROLES.AGGREGATE,
      120,
      90,
    ),
    false,
  );
  assert.equal(
    shouldRenderTreeShadowProxy(TREE_REPRESENTATION_ROLES.NEAR, 70, 90),
    false,
  );
});
