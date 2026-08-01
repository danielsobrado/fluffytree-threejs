import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

function createEmbeddedRootPath(points) {
  const first = points[0];
  return [
    {
      x: first.x,
      y: first.y - TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
      z: first.z,
    },
    ...points.map((point) => ({ ...point })),
  ];
}

export class BranchMeshBuilder {
  constructor({ geometryFactory = new TaperedCurveGeometryFactory() } = {}) {
    this.geometryFactory = geometryFactory;
  }

  build(treeData) {
    const geometries = [
      this.geometryFactory.create({
        path: createEmbeddedRootPath(treeData.trunk.points),
        startRadius: treeData.trunk.startRadius,
        endRadius: treeData.trunk.endRadius,
        sampleCount: TREE_STRUCTURE_RENDERING_CONSTANTS.trunkCurveSamples,
        flare: treeData.trunk.flare,
        capStart: true,
      }),
      ...treeData.branches.map((branch) =>
        this.geometryFactory.create({
          path: branch.points,
          startRadius: branch.startRadius,
          endRadius: branch.endRadius,
          sampleCount: TREE_STRUCTURE_RENDERING_CONSTANTS.branchCurveSamples,
        }),
      ),
    ];
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());

    if (!merged) {
      throw new Error('Failed to merge the generated tree structure.');
    }

    const material = new THREE.MeshStandardMaterial({
      color: treeData.trunkColor,
      roughness: 1,
      metalness: 0,
    });
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = 'tree-structure';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.structure = {
      rootCapped: true,
      rootEmbedDepth: TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
    };
    return mesh;
  }
}
