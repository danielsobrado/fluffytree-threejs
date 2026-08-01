import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RootCollarGeometryFactory, trimPathAboveHeight } from './root-collar-geometry-factory.js';
import {
  calculateRootCollarRadiusAtHeight,
  getRootCollarJoinHeight,
} from './root-collar-profile.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';

const TRUNK_INSIDE_COLLAR_RATIO = 0.9;

export class BranchMeshBuilder {
  constructor({
    geometryFactory = new TaperedCurveGeometryFactory(),
    rootCollarGeometryFactory = new RootCollarGeometryFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.rootCollarGeometryFactory = rootCollarGeometryFactory;
  }

  build(treeData) {
    const joinHeight = getRootCollarJoinHeight();
    const trunkPath = trimPathAboveHeight(treeData.trunk.points, joinHeight);
    const trunkStartRadius =
      calculateRootCollarRadiusAtHeight(
        treeData.trunk.startRadius,
        treeData.trunk.flare,
        joinHeight,
      ) * TRUNK_INSIDE_COLLAR_RATIO;
    const geometries = [
      this.rootCollarGeometryFactory.create({
        path: treeData.trunk.points,
        startRadius: treeData.trunk.startRadius,
        flare: treeData.trunk.flare,
        seed: treeData.seed,
      }),
      this.geometryFactory.create({
        path: trunkPath,
        startRadius: trunkStartRadius,
        endRadius: treeData.trunk.endRadius,
        sampleCount: TREE_STRUCTURE_RENDERING_CONSTANTS.trunkCurveSamples,
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
      rootCollar: true,
      rootEmbedDepth: TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
      rootCollarHeight: TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight,
      rootCollarOverlap: TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarOverlap,
    };
    return mesh;
  }
}
