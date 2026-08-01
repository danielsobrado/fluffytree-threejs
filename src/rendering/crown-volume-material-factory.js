import * as THREE from 'three';

const CROWN_MATERIAL_CONSTANTS = Object.freeze({
  roughness: 0.97,
  emissiveScale: 0.22,
  emissiveIntensity: 0.42,
});

export class CrownVolumeMaterialFactory {
  create(foliage) {
    const emissive = new THREE.Color(foliage.palette[1]).multiplyScalar(
      CROWN_MATERIAL_CONSTANTS.emissiveScale,
    );
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: CROWN_MATERIAL_CONSTANTS.roughness,
      metalness: 0,
      emissive,
      emissiveIntensity: CROWN_MATERIAL_CONSTANTS.emissiveIntensity,
      flatShading: false,
    });
    material.name = 'unified-crown-material';
    return material;
  }
}
