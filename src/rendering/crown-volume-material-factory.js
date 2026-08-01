import * as THREE from 'three';

export class CrownVolumeMaterialFactory {
  create() {
    const material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      colorWrite: false,
      depthWrite: false,
      depthTest: false,
      fog: false,
      toneMapped: false,
    });
    material.name = 'crown-shadow-proxy-material';
    return material;
  }
}
