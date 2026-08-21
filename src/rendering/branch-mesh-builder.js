import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { analyzeBufferGeometryManifold } from '../qa/mesh-manifold-analyzer.js?v=2.0.0-20260814.2';
import {
  calculateRootFlareScale,
  getRootFlareTopHeight,
} from './root-flare-profile.js?v=2.0.0-20260814.2';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js?v=2.0.0-20260814.2';
import { TREE_STRUCTURE_RENDERING_CONSTANTS } from './tree-structure-rendering-constants.js?v=2.0.0-20260814.2';
import { TrunkGeometryFactory } from './trunk-geometry-factory.js?v=2.0.0-20260814.2';
import {
  addStylizedBarkColors,
  StylizedBarkMaterialFactory,
} from './stylized-bark-material-factory.js?v=2.0.0-20260814.2';

function manifoldMetadata(metrics) {
  if (!metrics) return { manifoldAnalyzed: false };
  return {
    manifoldAnalyzed: true,
    trunkClosed: metrics.closedTwoManifold,
    trunkBoundaryEdges: metrics.boundaryEdgeCount,
    trunkNonManifoldEdges: metrics.nonManifoldEdgeCount,
    trunkOrientationConflicts: metrics.orientationConflictCount,
    trunkDegenerateTriangles: metrics.degenerateTriangleCount,
    trunkConnectedComponents: metrics.componentCount,
    trunkEulerCharacteristic: metrics.eulerCharacteristic,
    trunkOutwardFacing: metrics.outwardFacing,
    trunkSignedVolume: metrics.signedVolume,
  };
}

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
      analyzeManifold = true,
      name = 'tree-structure',
    } = {},
  ) {
    let trunkGeometry = null;
    const branchGeometries = [];
    let merged = null;
    let material = null;

    try {
      trunkGeometry = this.trunkGeometryFactory.create(treeData, {
        radialSegments,
        trunkCurveSamples,
      });
      const trunkPath = trunkGeometry.userData.trunkPath;
      const trunkManifold = analyzeManifold
        ? analyzeBufferGeometryManifold(trunkGeometry)
        : null;
      const rootBaseMaximumHeight =
        trunkGeometry.userData.sweptTube.startRingMaximumHeight;
      addStylizedBarkColors(
        trunkGeometry,
        treeData.barkPalette,
        treeData.seed,
        0,
        treeData.height,
      );

      for (const branch of treeData.branches) {
        if (branch.order > maxBranchOrder) continue;

        const geometry = this.geometryFactory.create({
          path: branch.points,
          startRadius: branch.startRadius,
          endRadius: branch.endRadius,
          sampleCount: branchCurveSamples,
          radialSegments,
          capEnd: branch.exposed,
        });
        branchGeometries.push(geometry);
        addStylizedBarkColors(
          geometry,
          treeData.barkPalette,
          treeData.seed + branch.id * 101,
          branch.order,
          treeData.height,
        );
      }

      merged = mergeGeometries([trunkGeometry, ...branchGeometries], false);
      if (!merged) {
        throw new Error('Failed to merge the generated tree structure.');
      }

      material = this.materialFactory.create({ height: treeData.height });
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.userData.structure = {
        ...manifoldMetadata(trunkManifold),
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

      merged = null;
      material = null;
      return mesh;
    } catch (error) {
      merged?.dispose();
      material?.dispose();
      throw error;
    } finally {
      trunkGeometry?.dispose();
      for (const geometry of branchGeometries) geometry.dispose();
    }
  }
}
