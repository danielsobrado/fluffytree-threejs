import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';
import { CrownVolumeBuilder } from './crown-volume-builder.js';

export class TreeMeshBuilder {
  constructor({
    branchMeshBuilder = new BranchMeshBuilder(),
    crownVolumeBuilder = new CrownVolumeBuilder(),
  } = {}) {
    this.branchMeshBuilder = branchMeshBuilder;
    this.crownVolumeBuilder = crownVolumeBuilder;
  }

  build(treeData, { sunDirection }) {
    if (!(sunDirection instanceof THREE.Vector3)) {
      throw new Error('TreeMeshBuilder requires a Three.js sun direction vector.');
    }

    const group = new THREE.Group();
    group.name = `tree-${treeData.presetId}`;

    const structure = this.branchMeshBuilder.build(treeData);
    const crown = this.crownVolumeBuilder.build(treeData);
    const volume = crown.geometry.userData.volume;

    group.userData.tree = {
      presetId: treeData.presetId,
      seed: treeData.seed,
      height: treeData.height,
      controlLobeCount: treeData.lobes.length,
      crownTriangleCount: volume.triangleCount,
      crownVertexCount: volume.vertexCount,
    };
    group.add(structure, crown);
    return group;
  }
}
