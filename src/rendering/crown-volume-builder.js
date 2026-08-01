import * as THREE from 'three';
import { CrownVolumeGeometryFactory } from './crown-volume-geometry-factory.js';
import { CrownVolumeMaterialFactory } from './crown-volume-material-factory.js';

function scaleAroundCenter(geometry, center, scale) {
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
    scaleAroundCenter(
      geometry,
      treeData.crownCenter,
      treeData.palette.shell.shadowProxyScale,
    );

    const crown = new THREE.Mesh(
      geometry,
      this.materialFactory.create(treeData.palette),
    );
    crown.name = 'crown-shadow-proxy';
    crown.castShadow = true;
    crown.receiveShadow = false;
    crown.frustumCulled = true;
    crown.userData.shadowProxy = {
      visibleSurface: false,
      scale: treeData.palette.shell.shadowProxyScale,
    };
    return crown;
  }
}
