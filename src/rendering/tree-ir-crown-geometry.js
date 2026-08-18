import * as THREE from 'three';

function surfaceNoise(x, y, z) {
  return (
    Math.sin(x * 4.7 + y * 6.1 + z * 5.3) * 0.55 +
    Math.sin(x * 9.2 - y * 3.8 + z * 7.6) * 0.45
  );
}

function addDepthColors(geometry, depthShading) {
  const positions = geometry.getAttribute('position');
  const colors = new Float32Array(positions.count * 3);
  const point = new THREE.Vector3();

  for (let index = 0; index < positions.count; index += 1) {
    point.fromBufferAttribute(positions, index).normalize();
    const vertical = point.y * depthShading * 0.35;
    const sideDepth = (1 - Math.abs(point.y)) * depthShading * 0.2;
    const brightness = Math.min(1.08, Math.max(0.82, 1 + vertical - sideDepth));
    const offset = index * 3;
    colors[offset] = brightness;
    colors[offset + 1] = brightness;
    colors[offset + 2] = brightness;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

export function createTreeIrCrownGeometry(
  detail,
  surfaceVariation = 0,
  depthShading = 0,
) {
  const geometry = new THREE.IcosahedronGeometry(1, detail);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const point = new THREE.Vector3();

  if (surfaceVariation > Number.EPSILON) {
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
  }

  addDepthColors(geometry, depthShading);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
