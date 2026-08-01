import * as THREE from 'three';
import { BranchMeshBuilder } from './branch-mesh-builder.js';
import { CrownVolumeBuilder } from './crown-volume-builder.js';
import { LeafClusterBuilder } from './leaf-cluster-builder.js';

export class TreeMeshBuilder {
  constructor({
    branchMeshBuilder = new BranchMeshBuilder(),
    crownVolumeBuilder = new CrownVolumeBuilder(),
    leafClusterBuilder = new LeafClusterBuilder(),
  } = {}) {
    this.branchMeshBuilder = branchMeshBuilder;
    this.crownVolumeBuilder = crownVolumeBuilder;
    this.leafClusterBuilder = leafClusterBuilder;
  }

  build(treeData) {
    const group = new THREE.Group();
    group.name = `tree-${treeData.presetId}`;

    const structure = this.branchMeshBuilder.build(treeData);
    const crown = this.crownVolumeBuilder.build(treeData);
    const leafDetail = this.leafClusterBuilder.build(treeData);
    const volume = crown.geometry.userData.volume;
    const leafMetrics = leafDetail.userData.leafDetail ?? {
      clusterCount: 0,
      leafCount: 0,
    };

    group.userData.tree = {
      presetId: treeData.presetId,
      seed: treeData.seed,
      height: treeData.height,
      controlLobeCount: treeData.lobes.length,
      crownTriangleCount: volume.triangleCount,
      crownVertexCount: volume.vertexCount,
      leafClusterCount: leafMetrics.clusterCount,
      leafCount: leafMetrics.leafCount,
    };
    group.add(structure, crown, leafDetail);
    return group;
  }
}
