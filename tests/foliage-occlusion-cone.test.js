import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCoreOccluderRadius,
  calculateOcclusionCone,
} from '../src/rendering/foliage-occlusion-cone.js';

const lobe = Object.freeze({
  id: 0,
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
  scale: Object.freeze({ x: 1, y: 1, z: 1 }),
});

/** Whether the cone culls a card seen from this direction. */
function culls(cone, view) {
  return cone.x * view.x + cone.y * view.y + cone.z * view.z > cone.w;
}

test('the cone points inward, from the card toward the core it sits on', () => {
  const cone = calculateOcclusionCone(
    { x: 0, y: 0, z: 2 },
    lobe,
    1,
    0.1,
  );

  assert.ok(Math.abs(cone.x) < 1e-12);
  assert.ok(Math.abs(cone.y) < 1e-12);
  assert.equal(cone.z, -1);
});

test('a card is culled from behind its core and kept from in front of it', () => {
  const occluderRadius = calculateCoreOccluderRadius(lobe, 0.67);
  const cone = calculateOcclusionCone(
    { x: 0, y: 0, z: 2 },
    lobe,
    occluderRadius,
    0.1,
  );

  // The camera is on the far side of the core, so the core stands between it
  // and the card.
  assert.ok(culls(cone, { x: 0, y: 0, z: -1 }));
  // The camera is on the card's own side; culling it would cut a hole in the
  // silhouette.
  assert.ok(!culls(cone, { x: 0, y: 0, z: 1 }));
  // Grazing the rim is the view the core has stopped covering.
  assert.ok(!culls(cone, { x: 1, y: 0, z: 0 }));
});

test('a card wider than the core it sits on is never culled', () => {
  const cone = calculateOcclusionCone({ x: 0, y: 0, z: 2 }, lobe, 0.4, 0.9);

  for (const view of [
    { x: 0, y: 0, z: -1 },
    { x: 0, y: 0, z: 1 },
    { x: 1, y: 0, z: 0 },
    { x: 0, y: 1, z: 0 },
  ]) {
    assert.ok(!culls(cone, view));
  }
});

test('a card inside its own core is never culled', () => {
  const cone = calculateOcclusionCone({ x: 0, y: 0, z: 0.1 }, lobe, 1, 0.05);

  assert.ok(!culls(cone, { x: 0, y: 0, z: -1 }));
});

test('the occluder is the sphere inscribed in the core, not its longest axis', () => {
  const flattened = {
    ...lobe,
    scale: Object.freeze({ x: 2, y: 0.5, z: 2 }),
  };

  assert.equal(
    calculateCoreOccluderRadius(flattened, 1),
    calculateCoreOccluderRadius({ ...lobe, scale: { x: 0.5, y: 0.5, z: 0.5 } }, 1),
  );
});

test('a bigger card reaches further and so is culled from fewer directions', () => {
  const near = calculateOcclusionCone({ x: 0, y: 0, z: 2 }, lobe, 1, 0.05);
  const far = calculateOcclusionCone({ x: 0, y: 0, z: 2 }, lobe, 1, 0.4);

  assert.ok(far.w > near.w);
});
