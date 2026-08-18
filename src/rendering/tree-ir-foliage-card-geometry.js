import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function bendNormals(geometry, normalBlend, normalUpBias) {
  if (normalBlend <= 0) return geometry;

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const original = new THREE.Vector3();
  const proxy = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    original.fromBufferAttribute(normals, index).normalize();
    proxy.set(
      positions.getX(index),
      normalUpBias + positions.getY(index) * 0.25,
      positions.getZ(index),
    );
    if (proxy.lengthSq() <= Number.EPSILON) proxy.copy(original);
    else proxy.normalize();
    if (proxy.dot(original) < 0) proxy.negate();
    original.lerp(proxy, normalBlend).normalize();
    normals.setXYZ(index, original.x, original.y, original.z);
  }
  normals.needsUpdate = true;
  return geometry;
}

export function createTreeIrFoliageCardGeometry({
  planeCount,
  depthSpread = 0,
  normalBlend = 0,
  normalUpBias = 0,
}) {
  const geometries = [];
  try {
    for (let index = 0; index < planeCount; index += 1) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const depthRatio = planeCount === 1 ? 0 : index / (planeCount - 1) - 0.5;
      geometry.translate(0, 0, depthRatio * depthSpread);
      geometry.rotateY((index * Math.PI) / planeCount);
      bendNormals(geometry, normalBlend, normalUpBias);
      geometries.push(geometry);
    }

    const merged = mergeGeometries(geometries, false);
    if (!merged) throw new Error('Failed to build direct IR foliage card geometry.');
    merged.computeBoundingBox();
    merged.computeBoundingSphere();
    return merged;
  } finally {
    for (const geometry of geometries) geometry.dispose();
  }
}
