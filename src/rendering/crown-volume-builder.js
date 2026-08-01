import * as THREE from 'three';
import { CrownVolumeGeometryFactory } from './crown-volume-geometry-factory.js';
import { CrownVolumeMaterialFactory } from './crown-volume-material-factory.js';

export class CrownVolumeBuilder {
  constructor({
    geometryFactory = new CrownVolumeGeometryFactory(),
    materialFactory = new CrownVolumeMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.materialFactory = materialFactory;
  }

  build(treeData) {
    const geometry = this.geometryFactory.create(treeData);
    const material = this.materialFactory.create(treeData.palette);
    const crown = new THREE.Mesh(geometry, material);
    crown.name = 'unified-crown';
    crown.castShadow = true;
    crown.receiveShadow = true;
    return crown;
  }
}
