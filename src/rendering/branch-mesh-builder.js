import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { analyzeBufferGeometryManifold } from '../qa/mesh-manifold-analyzer.js';
import {
  calculateRootFlareScale,
  getRootFlareTopHeight,
} from './root-flare-profile.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js';
import { TrunkGeometryFactory } from './trunk-geometry-factory.js';
import {
  addStylizedBarkColors,
  StylizedBarkMaterialFactory,
} from './stylized-bark-material-factory.js';

export class BranchMeshBuilder {
  constructor(options = {}) {
    this.geometryFactory =
      options.geometryFactory ?? new TaperedCurveGeometryFactory();
    this.trunkGeometryFactory =
      options.trunkGeometryFactory ??
      new TrunkGeometryFactory({ geometryFactory: this.geometryFactory });
    this.materialFactory =
      options.materialFactory ?? new StylizedBarkMaterialFactory();
  }

  build(
    treeData,
    {
      maxBranchOrder = Number.POSITIVE_INFINITY,
      radialSegments = 10,
      trunkCurveSamples = TREE_STRUCTURE_RENDERING_CONSTANTS.trunkCurveSamples,
      branchCurveSamples = TREE_STRUCTURE_RENDERING_CONSTANTS.branchCurveSamples,
      castShadow = true,
      receiveShadow = true,
      name = 'tree-structure',
    } = {},
  ) {
    const trunkGeometry = this.trunkGeometryFactory.create(treeData, {
      radialSegments,
      trunkCurveSamples,
    });
    const trunkPath = trunkGeometry.userData.trunkPath;
    const trunkManifold = analyzeBufferGeometryManifold(trunkGeometry);
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
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.userData.structure = {
      trunkClosed: trunkManifold.closedTwoManifold,
      trunkBoundaryEdges: trunkManifold.boundaryEdgeCount,
      trunkNonManifoldEdges: trunkManifold.nonManifoldEdgeCount,
      trunkOrientationConflicts: trunkManifold.orientationConflictCount,
      trunkDegenerateTriangles: trunkManifold.degenerateTriangleCount,
      trunkConnectedComponents: trunkManifold.componentCount,
      trunkEulerCharacteristic: trunkManifold.eulerCharacteristic,
      trunkOutwardFacing: trunkManifold.outwardFacing,
      trunkSignedVolume: trunkManifold.signedVolume,
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
      lowestBranchHeight: treeData.branches.reduce(
        (lowest, branch) => Math.min(lowest, branch.points[0].y),
        Number.POSITIVE_INFINITY,
      ),
      branchCount: branchGeometries.length,
      maximumBranchOrder: maxBranchOrder,
    };
    return mesh;
  }
}
