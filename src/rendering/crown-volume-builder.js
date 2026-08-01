import * as THREE from 'three';
import { CrownVolumeGeometryFactory } from './crown-volume-geometry-factory.js';
import { CrownVolumeMaterialFactory } from './crown-volume-material-factory.js';

function insetAroundCenter(geometry, center, scale) {
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  geometry.translate(center.x, center.y, center.z);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

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
    const settings = treeData.palette.leafDetail;
    insetAroundCenter(geometry, treeData.crownCenter, settings.coreScale);

    const material = this.materialFactory.create(treeData.palette);
    const crown = new THREE.Mesh(geometry, material);
    crown.name = 'inner-crown-core';
    crown.castShadow = true;
    crown.receiveShadow = true;
    crown.userData.innerCore = {
      scale: settings.coreScale,
      brightness: settings.coreBrightness,
    };
    return crown;
  }
}
