import * as THREE from 'three';
import { FOLIAGE_RENDERING_CONSTANTS } from './foliage-rendering-constants.js?v=2.0.0-20260814.2';

export class FoliageCoreGeometryFactory {
  create(detail = 1) {
    const geometry = new THREE.IcosahedronGeometry(
      1,
      detail,
    );
    const positions = geometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let index = 0; index < positions.count; index += 1) {
      vertex.fromBufferAttribute(positions, index);
      const deformation =
        1 +
        Math.sin(vertex.x * 7.1 + vertex.y * 4.7) *
          FOLIAGE_RENDERING_CONSTANTS.coreLobeDeformation +
        Math.sin(vertex.z * 6.3 - vertex.y * 3.9) *
          FOLIAGE_RENDERING_CONSTANTS.coreLobeDeformation *
          0.6;
      vertex.multiplyScalar(deformation);
      positions.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.name = 'foliage-core-geometry';
    return geometry;
  }
}
