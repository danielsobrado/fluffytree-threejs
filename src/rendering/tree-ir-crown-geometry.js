import * as THREE from 'three';

function surfaceNoise(x, y, z) {
  return (
    Math.sin(x * 4.7 + y * 6.1 + z * 5.3) * 0.55 +
    Math.sin(x * 9.2 - y * 3.8 + z * 7.6) * 0.45
  );
}

export function createTreeIrCrownGeometry(detail, surfaceVariation = 0) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  if (surfaceVariation <= Number.EPSILON) return geometry;

  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const point = new THREE.Vector3();
  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).normalize();
    const radius =
      1 + surfaceNoise(point.x, point.y, point.z) * surfaceVariation;
    positions.setXYZ(
      index,
      point.x * radius,
      point.y * radius,
      point.z * radius,
    );
    normals.setXYZ(index, point.x, point.y, point.z);
  }
  positions.needsUpdate = true;
  normals.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
