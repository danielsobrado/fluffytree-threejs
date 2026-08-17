import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { analyzeBufferGeometryManifold } from '../qa/mesh-manifold-analyzer.js';
import { TaperedCurveGeometryFactory } from './tapered-curve-geometry-factory.js';
import { TREE_BARK_PATTERNS } from './tree-bark-style-constants.js';
import { createRenderableTreeIrStemPath } from './tree-ir-render-path.js';
import { createTreeIrTrunkRenderData } from './tree-ir-trunk-render-data.js';
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

function includeStem(stem, maximumStemOrder) {
  return maximumStemOrder === null || stem.order <= maximumStemOrder;
}

function trunkBarkPattern(treeIr) {
  return treeIr.generationModel === 'palm'
    ? TREE_BARK_PATTERNS.PALM
    : TREE_BARK_PATTERNS.WOOD;
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
      trunkGeometry = this.trunkGeometryFactory.create(
        createTreeIrTrunkRenderData(treeIr, root),
        {
          radialSegments,
          trunkCurveSamples,
        },
      );
      const trunkManifold = analyzeManifold
        ? analyzeBufferGeometryManifold(trunkGeometry)
        : null;
      addStylizedBarkColors(
        trunkGeometry,
        treeIr.metadata.material.barkPalette,
        treeIr.seed,
        0,
        treeIr.height,
        { pattern: trunkBarkPattern(treeIr) },
      );

      for (const stem of treeIr.stems) {
        if (stem.id === root.id || !includeStem(stem, maximumStemOrder)) continue;
        const geometry = this.geometryFactory.create({
          path: createRenderableTreeIrStemPath(stem.path),
          startRadius: stem.startRadius,
          endRadius: stem.endRadius,
          sampleCount: branchCurveSamples,
          radialSegments,
          taperExponent: stem.taperPower,
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
        barkPattern: trunkBarkPattern(treeIr),
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
