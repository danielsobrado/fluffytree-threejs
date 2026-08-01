import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  RootCollarGeometryFactory,
  trimPathAboveHeight,
} from './root-collar-geometry-factory.js';
import {
  calculateRootCollarRadiusAtHeight,
  getRootCollarJoinHeight,
} from './root-collar-profile.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';
import {
  addStylizedBarkColors,
  StylizedBarkMaterialFactory,
} from './stylized-bark-material-factory.js';

const TRUNK_INSIDE_COLLAR_RATIO = 0.9;

export class BranchMeshBuilder {
  constructor({
    geometryFactory = new TaperedCurveGeometryFactory(),
    rootCollarGeometryFactory = new RootCollarGeometryFactory(),
    materialFactory = new StylizedBarkMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.rootCollarGeometryFactory = rootCollarGeometryFactory;
    this.materialFactory = materialFactory;
  }

  build(
    treeData,
    {
      maxBranchOrder = Number.POSITIVE_INFINITY,
      radialSegments = 10,
      trunkCurveSamples = TREE_STRUCTURE_RENDERING_CONSTANTS.trunkCurveSamples,
      branchCurveSamples = TREE_STRUCTURE_RENDERING_CONSTANTS.branchCurveSamples,
      name = 'tree-structure',
    } = {},
  ) {
    const joinHeight = getRootCollarJoinHeight();
    const trunkPath = trimPathAboveHeight(treeData.trunk.points, joinHeight);
    const trunkStartRadius =
      calculateRootCollarRadiusAtHeight(
        treeData.trunk.startRadius,
        treeData.trunk.flare,
        joinHeight,
      ) * TRUNK_INSIDE_COLLAR_RATIO;
    const rootGeometry = this.rootCollarGeometryFactory.create({
        path: treeData.trunk.points,
        startRadius: treeData.trunk.startRadius,
        flare: treeData.trunk.flare,
        seed: treeData.seed,
      });
    addStylizedBarkColors(rootGeometry, treeData.barkPalette, treeData.seed, 0);
    const trunkGeometry = this.geometryFactory.create({
        path: trunkPath,
        startRadius: trunkStartRadius,
        endRadius: treeData.trunk.endRadius,
        sampleCount: trunkCurveSamples,
        radialSegments,
      });
    addStylizedBarkColors(trunkGeometry, treeData.barkPalette, treeData.seed, 0);
    const branchGeometries = treeData.branches
      .filter((branch) => branch.order <= maxBranchOrder)
      .map((branch) => {
        const geometry = this.geometryFactory.create({
          path: branch.points,
          startRadius: branch.startRadius,
          endRadius: branch.endRadius,
          sampleCount: branchCurveSamples,
          radialSegments,
          capEnd: branch.exposed,
        });
        addStylizedBarkColors(
          geometry,
          treeData.barkPalette,
          treeData.seed + branch.id * 101,
          branch.order,
        );
        return geometry;
      });
    const geometries = [rootGeometry, trunkGeometry, ...branchGeometries];
    const merged = mergeGeometries(geometries, false);
    geometries.forEach((geometry) => geometry.dispose());

    if (!merged) {
      throw new Error('Failed to merge the generated tree structure.');
    }

    const material = this.materialFactory.create({ height: treeData.height });
    const mesh = new THREE.Mesh(merged, material);
    mesh.name = name;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.structure = {
      rootCapped: true,
      rootBottomCapped: true,
      rootTopCapped: false,
      rootCollar: true,
      rootEmbedDepth: TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
      rootCollarHeight: TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarHeight,
      rootCollarOverlap: TREE_STRUCTURE_RENDERING_CONSTANTS.rootCollarOverlap,
      branchCount: branchGeometries.length,
      maximumBranchOrder: maxBranchOrder,
    };
    return mesh;
  }
}
