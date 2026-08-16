import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { analyzeBufferGeometryManifold } from '../qa/mesh-manifold-analyzer.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TrunkGeometryFactory } from './trunk-geometry-factory.js';
import {
  addStylizedBarkColors,
  StylizedBarkMaterialFactory,
} from './stylized-bark-material-factory.js';

function rootStem(treeIr) {
  const root = treeIr.stems.find((stem) => stem.id === treeIr.root.stemId);
  if (!root) throw new Error(`Tree IR '${treeIr.presetId}' has no root stem.`);
  return root;
}

function rootTreeData(treeIr, stem) {
  return {
    height: treeIr.height,
    trunk: {
      points: stem.path,
      startRadius: stem.startRadius,
      endRadius: stem.endRadius,
      flare: Number(stem.metadata?.flare ?? 0),
      taperPower: stem.taperPower,
      nebari: Number(stem.metadata?.nebari ?? 1),
    },
  };
}

function includeStem(stem, maximumStemOrder) {
  return maximumStemOrder === null || stem.order <= maximumStemOrder;
}

export class TreeIrStructureMeshBuilder {
  constructor({
    geometryFactory = new TaperedCurveGeometryFactory(),
    trunkGeometryFactory = null,
    materialFactory = new StylizedBarkMaterialFactory(),
  } = {}) {
    this.geometryFactory = geometryFactory;
    this.trunkGeometryFactory =
      trunkGeometryFactory ?? new TrunkGeometryFactory({ geometryFactory });
    this.materialFactory = materialFactory;
  }

  build(
    treeIr,
    {
      maximumStemOrder = null,
      radialSegments,
      trunkCurveSamples,
      branchCurveSamples,
      castShadow = false,
      receiveShadow = true,
      analyzeManifold = false,
      name = 'tree-ir-structure',
    },
  ) {
    const root = rootStem(treeIr);
    let trunkGeometry = null;
    const branchGeometries = [];
    let merged = null;
    let material = null;

    try {
      trunkGeometry = this.trunkGeometryFactory.create(rootTreeData(treeIr, root), {
        radialSegments,
        trunkCurveSamples,
      });
      const trunkManifold = analyzeManifold
        ? analyzeBufferGeometryManifold(trunkGeometry)
        : null;
      addStylizedBarkColors(
        trunkGeometry,
        treeIr.metadata.material.barkPalette,
        treeIr.seed,
        0,
        treeIr.height,
      );

      for (const stem of treeIr.stems) {
        if (stem.id === root.id || !includeStem(stem, maximumStemOrder)) continue;
        const geometry = this.geometryFactory.create({
          path: stem.path,
          startRadius: stem.startRadius,
          endRadius: stem.endRadius,
          sampleCount: branchCurveSamples,
          radialSegments,
          capEnd: stem.exposedTip,
        });
        branchGeometries.push(geometry);
        addStylizedBarkColors(
          geometry,
          treeIr.metadata.material.barkPalette,
          treeIr.seed + branchGeometries.length * 101,
          stem.order,
          treeIr.height,
        );
      }

      merged = mergeGeometries([trunkGeometry, ...branchGeometries], false);
      if (!merged) throw new Error('Failed to merge Tree IR structure geometry.');
      material = this.materialFactory.create({ height: treeIr.height });
      const mesh = new THREE.Mesh(merged, material);
      mesh.name = name;
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.userData.structure = Object.freeze({
        treeIr: true,
        stemCount: 1 + branchGeometries.length,
        maximumStemOrder,
        manifoldAnalyzed: Boolean(trunkManifold),
        trunkClosed: trunkManifold?.closedTwoManifold ?? null,
      });
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
