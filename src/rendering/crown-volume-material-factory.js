import * as THREE from 'three';
import { CROWN_VOLUME_RENDERING_CONSTANTS } from './crown-volume-rendering-constants.js';

export class CrownVolumeMaterialFactory {
  create(foliage) {
    const emissive = new THREE.Color(foliage.palette[1]).multiplyScalar(
      CROWN_VOLUME_RENDERING_CONSTANTS.emissiveScale,
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: CROWN_VOLUME_RENDERING_CONSTANTS.roughness,
      metalness: 0,
      emissive,
      emissiveIntensity: CROWN_VOLUME_RENDERING_CONSTANTS.emissiveIntensity,
      flatShading: false,
    });
    material.name = 'unified-crown-material';
    return material;
  }
}
