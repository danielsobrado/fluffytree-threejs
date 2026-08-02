import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  analyzeGeometryBoundary,
  calculateSignedVolume,
} from '../qa/geometry-boundary-analyzer.js';
import {
  calculateRootFlareScale,
  calculateRootRadiusScale,
  extendPathBelowGround,
  getRootFlareTopHeight,
} from './root-flare-profile.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';
import {
  addStylizedBarkColors,
  StylizedBarkMaterialFactory,
} from './stylized-bark-material-factory.js';

export class BranchMeshBuilder {
  constructor({
    geometryFactory = new TaperedCurveGeometryFactory(),
    materialFactory = new StylizedBarkMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
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
    const trunkPath = extendPathBelowGround(treeData.trunk.points);
    const trunkGeometry = this.geometryFactory.create({
      path: trunkPath,
      startRadius: treeData.trunk.startRadius,
      endRadius: treeData.trunk.endRadius,
      sampleCount: trunkCurveSamples,
      sampleBias: TREE_STRUCTURE_RENDERING_CONSTANTS.trunkSampleBias,
      radiusScale: ({ angle, height }) =>
        calculateRootRadiusScale(
          treeData.trunk.flare,
          angle,
          height,
          treeData.seed,
        ),
      capStart: true,
      capEnd: true,
      radialSegments,
    });
    const trunkBoundary = analyzeGeometryBoundary(trunkGeometry.getIndex().array);
    const trunkVolume = calculateSignedVolume(
      trunkGeometry.getAttribute('position').array,
      trunkGeometry.getIndex().array,
    );
    const rootBaseMaximumHeight =
      trunkGeometry.userData.sweptTube.startRingMaximumHeight;
    addStylizedBarkColors(
      trunkGeometry,
      treeData.barkPalette,
      treeData.seed,
      0,
      treeData.height,
    );
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
          treeData.height,
        );
        return geometry;
      });
    const geometries = [trunkGeometry, ...branchGeometries];
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
      trunkClosed: trunkBoundary.closed,
      trunkBoundaryEdges: trunkBoundary.boundaryEdges,
      trunkNonManifoldEdges: trunkBoundary.nonManifoldEdges,
      trunkOutwardFacing: trunkVolume > 0,
      trunkSignedVolume: trunkVolume,
      rootEmbedDepth: TREE_STRUCTURE_RENDERING_CONSTANTS.rootEmbedDepth,
      rootBaseMaximumHeight,
      rootBase: {
        x: trunkPath[0].x,
        y: trunkPath[0].y,
        z: trunkPath[0].z,
        radius:
          treeData.trunk.startRadius *
          calculateRootFlareScale(treeData.trunk.flare, trunkPath[0].y),
      },
      rootFlareHeight: getRootFlareTopHeight(),
      branchCount: branchGeometries.length,
      maximumBranchOrder: maxBranchOrder,
    };
    return mesh;
  }
}
