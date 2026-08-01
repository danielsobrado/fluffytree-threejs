import * as THREE from 'three';
import { CrownVolumeGenerator } from '../generation/crown-volume-generator.js';
import { createCrownVertexColors } from './crown-color-sampler.js';

export class CrownVolumeGeometryFactory {
  constructor({ volumeGenerator = new CrownVolumeGenerator() } = {}) {
    this.volumeGenerator = volumeGenerator;
  }

  create(treeData) {
    const volume = this.volumeGenerator.generate(treeData);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(volume.positions, 3),
    );
    geometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(volume.normals, 3),
    );
    geometry.setAttribute(
      'color',
      new THREE.BufferAttribute(createCrownVertexColors(treeData, volume), 3),
    );
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = 'unified-crown-volume';
    geometry.userData.volume = {
      triangleCount: volume.triangleCount,
      vertexCount: volume.vertexCount,
      gridCounts: volume.grid.counts,
      cellSize: volume.grid.cellSize,
    };
    return geometry;
  }
}
